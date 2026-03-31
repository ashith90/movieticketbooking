const jwt = require("jsonwebtoken");

function parseToken(req) {
  if (req.cookies?.accessToken) {
    return req.cookies.accessToken;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  return authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;
}

function optionalAuth(req, res, next) {
  const token = parseToken(req);
  if (!token) return next();

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
  } catch (_error) {
    return res.status(401).json({ message: "Invalid token" });
  }

  return next();
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

module.exports = {
  optionalAuth,
  requireAuth,
};
