const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Subject name is required"], trim: true },
    code: { type: String, required: [true, "Subject code is required"], unique: true, uppercase: true, trim: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: [true, "Department is required"] },
    semester: { type: Number, required: [true, "Semester is required"], min: 1, max: 8 },
    subjectType: { type: String, enum: ["Theory", "Practical", "Lab"], required: true },
    weeklyHours: { type: Number, required: true, min: 1, max: 20 },
    requiredRoomType: { type: String, enum: ["Classroom", "Computer Lab", "Science Lab", "Any"], default: "Classroom" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Subject", subjectSchema);
