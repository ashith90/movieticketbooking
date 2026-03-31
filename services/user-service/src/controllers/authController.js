const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

function signAccessToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), email: user.email, role: user.role || "user" },
    process.env.JWT_SECRET || "dev-secret",
    { expiresIn: process.env.JWT_EXPIRES_IN || "15m" }
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), type: "refresh" },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "dev-secret",
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d" }
  );
}

function parseExpiresInMs(value, fallbackMs) {
  if (!value) return fallbackMs;
  const parsed = String(value).trim();
  if (/^\d+$/.test(parsed)) {
    return Number(parsed) * 1000;
  }

  const match = parsed.match(/^(\d+)([smhd])$/i);
  if (!match) return fallbackMs;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * (multipliers[unit] || 1000);
}

function cookieOptions(maxAge) {
  const secure = String(process.env.COOKIE_SECURE || "false").toLowerCase() === "true";
  return {
    httpOnly: true,
    sameSite: secure ? "none" : "lax",
    secure,
    maxAge,
    path: "/",
  };
}

async function persistRefreshToken(user, refreshToken) {
  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  const refreshTtlMs = parseExpiresInMs(process.env.JWT_REFRESH_EXPIRES_IN || "30d", 30 * 86400000);

  await User.findByIdAndUpdate(user._id, {
    refreshTokenHash,
    refreshTokenExpiresAt: new Date(Date.now() + refreshTtlMs),
  });

  return refreshTtlMs;
}

function setAuthCookies(res, accessToken, refreshToken, refreshTtlMs) {
  const accessTtlMs = parseExpiresInMs(process.env.JWT_EXPIRES_IN || "15m", 15 * 60000);
  res.cookie("accessToken", accessToken, cookieOptions(accessTtlMs));
  res.cookie("refreshToken", refreshToken, cookieOptions(refreshTtlMs));
}

function clearAuthCookies(res) {
  res.clearCookie("accessToken", { path: "/" });
  res.clearCookie("refreshToken", { path: "/" });
}

function authResponse(user, accessToken) {
  return {
    token: accessToken,
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      city: user.city,
      role: user.role,
    },
  };
}

function shouldAssignAdminRole(email) {
  const raw = process.env.ADMIN_EMAILS || "";
  const allowList = raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return allowList.includes(String(email || "").toLowerCase());
}

async function signup(req, res, next) {
  try {
    const { email, password, name, phone, city } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ message: "email, password and name are required" });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      name,
      phone,
      city,
      role: shouldAssignAdminRole(email) ? "admin" : "user",
    });

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    const refreshTtlMs = await persistRefreshToken(user, refreshToken);
    setAuthCookies(res, accessToken, refreshToken, refreshTtlMs);

    return res.status(201).json(authResponse(user, accessToken));
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    let activeUser = user;
    if (shouldAssignAdminRole(email) && user.role !== "admin") {
      user.role = "admin";
      await user.save();
      activeUser = user;
    }

    const accessToken = signAccessToken(activeUser);
    const refreshToken = signRefreshToken(activeUser);
    const refreshTtlMs = await persistRefreshToken(activeUser, refreshToken);
    setAuthCookies(res, accessToken, refreshToken, refreshTtlMs);

    return res.json(authResponse(activeUser, accessToken));
  } catch (error) {
    return next(error);
  }
}

async function refresh(req, res, next) {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ message: "Refresh token is required" });
    }

    let payload;
    try {
      payload = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "dev-secret"
      );
    } catch (_error) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    if (payload.type !== "refresh") {
      return res.status(401).json({ message: "Invalid refresh token type" });
    }

    const user = await User.findById(payload.userId);
    if (!user || !user.refreshTokenHash || !user.refreshTokenExpiresAt) {
      return res.status(401).json({ message: "Refresh session not found" });
    }

    if (new Date(user.refreshTokenExpiresAt).getTime() < Date.now()) {
      return res.status(401).json({ message: "Refresh token expired" });
    }

    const isMatch = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!isMatch) {
      return res.status(401).json({ message: "Refresh token mismatch" });
    }

    const accessToken = signAccessToken(user);
    const nextRefreshToken = signRefreshToken(user);
    const refreshTtlMs = await persistRefreshToken(user, nextRefreshToken);
    setAuthCookies(res, accessToken, nextRefreshToken, refreshTtlMs);

    return res.json(authResponse(user, accessToken));
  } catch (error) {
    return next(error);
  }
}

async function logout(req, res, next) {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (refreshToken) {
      try {
        const payload = jwt.verify(
          refreshToken,
          process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "dev-secret"
        );
        await User.findByIdAndUpdate(payload.userId, {
          $unset: {
            refreshTokenHash: "",
            refreshTokenExpiresAt: "",
          },
        });
      } catch (_error) {
        // Ignore invalid token on logout and clear cookies anyway.
      }
    }

    clearAuthCookies(res);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  signup,
  login,
  refresh,
  logout,
};
