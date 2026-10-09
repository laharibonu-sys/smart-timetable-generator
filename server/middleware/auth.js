const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Verify JWT and attach user to req
const protect = async (req, res, next) => {
  const token = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.split(" ")[1]
    : null;

  if (!token) {
    const err = new Error("Not authorized, no token");
    err.statusCode = 401;
    return next(err);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select("-password");
    if (!req.user) {
      const err = new Error("User not found");
      err.statusCode = 401;
      return next(err);
    }
    if (!req.user.isActive) {
      const err = new Error("Account is inactive");
      err.statusCode = 403;
      return next(err);
    }
    next();
  } catch {
    const err = new Error("Token invalid or expired");
    err.statusCode = 401;
    return next(err);
  }
};

// Allow one or more specific roles: authorizeRoles("admin", "faculty")
const authorizeRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    const err = new Error(`Access denied. Required role: ${roles.join(" or ")}`);
    err.statusCode = 403;
    return next(err);
  }
  next();
};

// Convenience alias
const adminOnly = authorizeRoles("admin");

module.exports = { protect, authorizeRoles, adminOnly };
