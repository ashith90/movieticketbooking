function requireAuth(req, res, next) {
  const userId = req.header("x-user-id");

  if (!userId) {
    return res.status(401).json({ message: "x-user-id header required" });
  }

  req.user = { userId };
  return next();
}

module.exports = {
  requireAuth,
};
