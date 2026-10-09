const jwt = require("jsonwebtoken");
const User = require("../models/User");

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

const createError = (message, status = 400) => {
  const err = new Error(message);
  err.statusCode = status;
  return err;
};

const safeUser = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  facultyRef: u.facultyRef,
  sectionRef: u.sectionRef,
  isActive: u.isActive,
});

// POST /api/auth/login  — public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return next(createError("Email and password are required"));

    const user = await User.findOne({ email });
    // Generic message — do not reveal whether email exists
    if (!user || !(await user.matchPassword(password)))
      return next(createError("Invalid email or password", 401));

    if (!user.isActive)
      return next(createError("Account is inactive. Contact an administrator.", 403));

    res.json({ success: true, token: generateToken(user._id), user: safeUser(user) });
  } catch (err) { next(err); }
};

// POST /api/auth/logout  — protected (client drops token; server confirms)
const logout = (req, res) => {
  // JWT is stateless — the client must discard the token.
  // This endpoint exists so the frontend can call it cleanly.
  res.json({ success: true, message: "Logged out successfully" });
};

// GET /api/auth/me  — protected
const getMe = async (req, res) => {
  res.json({ success: true, user: safeUser(req.user) });
};

// POST /api/auth/register  — protected + admin-only (see authRoutes)
const register = async (req, res, next) => {
  try {
    const { name, email, password, role, facultyRef, sectionRef } = req.body;
    if (!name || !email || !password)
      return next(createError("Name, email and password are required"));

    // Enforce minimum password length
    if (password.length < 6)
      return next(createError("Password must be at least 6 characters"));

    // Prevent privilege escalation — only admin can create admin accounts
    const allowedRoles = ["admin", "faculty", "student"];
    const assignedRole = allowedRoles.includes(role) ? role : "faculty";

    const exists = await User.findOne({ email });
    if (exists) return next(createError("Email already registered", 409));

    const user = await User.create({
      name, email, password,
      role: assignedRole,
      facultyRef: facultyRef || null,
      sectionRef: sectionRef || null,
    });

    res.status(201).json({ success: true, user: safeUser(user) });
  } catch (err) { next(err); }
};

// POST /api/auth/change-password  — protected (any authenticated user)
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return next(createError("Current password and new password are required"));

    if (newPassword.length < 6)
      return next(createError("New password must be at least 6 characters"));

    // Re-fetch with password field (select("-password") is used in protect middleware)
    const user = await User.findById(req.user._id);
    if (!user) return next(createError("User not found", 404));

    const match = await user.matchPassword(currentPassword);
    if (!match) return next(createError("Current password is incorrect", 401));

    user.password = newPassword; // pre-save hook will hash it
    await user.save();

    res.json({ success: true, message: "Password changed successfully" });
  } catch (err) { next(err); }
};

// PATCH /api/auth/users/:id  — admin-only: update name, role, isActive, refs
const updateUser = async (req, res, next) => {
  try {
    const { name, role, isActive, facultyRef, sectionRef } = req.body;

    // Prevent changing own role (safety guard)
    if (String(req.user._id) === req.params.id && role && role !== req.user.role)
      return next(createError("You cannot change your own role", 403));

    const allowed = ["admin", "faculty", "student"];
    const update = {};
    if (name !== undefined) update.name = name;
    if (role !== undefined && allowed.includes(role)) update.role = role;
    if (isActive !== undefined) update.isActive = isActive;
    if (facultyRef !== undefined) update.facultyRef = facultyRef;
    if (sectionRef !== undefined) update.sectionRef = sectionRef;

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select("-password");
    if (!user) return next(createError("User not found", 404));

    res.json({ success: true, user: safeUser(user) });
  } catch (err) { next(err); }
};

// GET /api/auth/users  — admin-only: list all users
const listUsers = async (req, res, next) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (err) { next(err); }
};

module.exports = { login, logout, getMe, register, changePassword, updateUser, listUsers };
