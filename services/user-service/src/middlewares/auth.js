const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const tokenFromCookie = req.cookies?.accessToken;
  const authHeader = req.headers.authorization;
  if (!tokenFromCookie && !authHeader) {
    return res.status(401).json({ message: "Authorization required" });
  }

  const token = tokenFromCookie || (authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader);

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
    return next();
  } catch (_error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

module.exports = {
  requireAuth,
};
