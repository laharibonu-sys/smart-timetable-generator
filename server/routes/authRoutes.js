const express = require("express");
const router = express.Router();
const {
  login, logout, getMe, register, changePassword, updateUser, listUsers,
} = require("../controllers/authController");
const { protect, adminOnly } = require("../middleware/auth");

// Public
router.post("/login", login);

// Authenticated (any role)
router.post("/logout", protect, logout);
router.get("/me", protect, getMe);
router.post("/change-password", protect, changePassword);

// Admin-only: account management
router.post("/register", protect, adminOnly, register);
router.get("/users", protect, adminOnly, listUsers);
router.patch("/users/:id", protect, adminOnly, updateUser);

module.exports = router;
