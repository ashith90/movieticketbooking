const User = require("../models/User");

async function getMe(req, res, next) {
  try {
    const user = await User.findById(req.user.userId).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json(user);
  } catch (error) {
    return next(error);
  }
}

async function updateMe(req, res, next) {
  try {
    const updates = {
      name: req.body.name,
      city: req.body.city,
      phone: req.body.phone,
    };

    Object.keys(updates).forEach((key) => {
      if (updates[key] === undefined) {
        delete updates[key];
      }
    });

    const user = await User.findByIdAndUpdate(req.user.userId, updates, {
      new: true,
      runValidators: true,
    }).select("-passwordHash");

    return res.json(user);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getMe,
  updateMe,
};
