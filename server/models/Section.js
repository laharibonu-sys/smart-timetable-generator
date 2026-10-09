const mongoose = require("mongoose");

const sectionSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Section name is required"], trim: true, uppercase: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true },
    academicYear: { type: String, required: [true, "Academic year is required"], trim: true },
    semester: { type: Number, required: true, min: 1, max: 8 },
    studentCount: { type: Number, default: 0, min: 0 },
    classTeacher: { type: mongoose.Schema.Types.ObjectId, ref: "Faculty" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Section", sectionSchema);
