const mongoose = require("mongoose");

const facultySchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Name is required"], trim: true },
    employeeId: { type: String, required: [true, "Employee ID is required"], unique: true, trim: true },
    email: { type: String, required: [true, "Email is required"], unique: true, lowercase: true, trim: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true },
    specialization: { type: String, trim: true },
    subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: "Subject" }],
    maxWeeklyHours: { type: Number, default: 20, min: 1, max: 40 },
    availability: {
      type: Map,
      of: [String],
      default: {},
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Faculty", facultySchema);
