const mongoose = require("mongoose");

const timeSlotSchema = new mongoose.Schema(
  {
    slotName: { type: String, required: [true, "Slot name is required"], trim: true },
    startTime: { type: String, required: [true, "Start time is required"] },
    endTime: { type: String, required: [true, "End time is required"] },
    slotType: { type: String, enum: ["Regular Class", "Lab", "Break"], required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

timeSlotSchema.pre("save", function () {
  const [sh, sm] = this.startTime.split(":").map(Number);
  const [eh, em] = this.endTime.split(":").map(Number);
  if (eh * 60 + em <= sh * 60 + sm) {
    throw new Error("End time must be after start time");
  }
});

module.exports = mongoose.model("TimeSlot", timeSlotSchema);
