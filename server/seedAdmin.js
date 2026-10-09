/**
 * seedAdmin.js — Run ONCE to create the first admin account.
 *
 * Usage:
 *   node seedAdmin.js
 *
 * Reads SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD from .env.
 * If those are not set, it falls back to safe defaults printed below.
 * Will NOT create a duplicate if an admin already exists.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");

const SEED_EMAIL    = process.env.SEED_ADMIN_EMAIL    || "admin@college.edu";
const SEED_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "Admin@1234";
const SEED_NAME     = process.env.SEED_ADMIN_NAME     || "System Administrator";

async function seed() {
  if (!process.env.MONGO_URI) {
    console.error("ERROR: MONGO_URI is not set in .env");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const existing = await User.findOne({ role: "admin" });
  if (existing) {
    console.log(`Admin already exists: ${existing.email}`);
    console.log("No changes made. Exiting.");
    await mongoose.disconnect();
    return;
  }

  // Password is hashed by the pre-save hook in User model
  const admin = await User.create({
    name: SEED_NAME,
    email: SEED_EMAIL,
    password: SEED_PASSWORD,
    role: "admin",
    isActive: true,
  });

  console.log("Admin account created successfully:");
  console.log(`  Name  : ${admin.name}`);
  console.log(`  Email : ${admin.email}`);
  console.log(`  Role  : ${admin.role}`);
  console.log("\nIMPORTANT: Change this password immediately after first login.");

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
