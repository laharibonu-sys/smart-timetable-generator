const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name:       { type: String, required: true, trim: true },
    email:      { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:   { type: String, required: true, minlength: 6 },
    role:       { type: String, enum: ["admin", "faculty", "student"], default: "admin" },
    // Link to Faculty document (for faculty role)
    facultyRef: { type: mongoose.Schema.Types.ObjectId, ref: "Faculty", default: null },
    // Link to Section document (for student role)
    sectionRef: { type: mongoose.Schema.Types.ObjectId, ref: "Section", default: null },
    isActive:   { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Hash password only when it is new or changed
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
