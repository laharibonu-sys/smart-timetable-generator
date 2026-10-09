const mongoose = require("mongoose");

const classroomSchema = new mongoose.Schema(
  {
    roomNumber: { type: String, required: [true, "Room number is required"], unique: true, trim: true },
    building: { type: String, trim: true },
    roomType: { type: String, enum: ["Classroom", "Computer Lab", "Science Lab", "Other"], required: true },
    capacity: { type: Number, required: [true, "Capacity is required"], min: [1, "Capacity must be at least 1"] },
    equipment: [{ type: String, trim: true }],
    isAvailable: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Classroom", classroomSchema);
