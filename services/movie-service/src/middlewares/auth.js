const jwt = require("jsonwebtoken");

function parseToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  return authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;
}

function requireAuth(req, res, next) {
  const token = parseToken(req);
  if (!token) {
    return res.status(401).json({ message: "Authorization required" });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
    return next();
  } catch (_error) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Authorization required" });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin role required" });
  }

  return next();
}

module.exports = {
  requireAuth,
  requireAdmin,
};