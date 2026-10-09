const mongoose = require("mongoose");

const workingDaySchema = new mongoose.Schema(
  {
    dayName: {
      type: String,
      required: true,
      unique: true,
      enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    },
    isWorkingDay: { type: Boolean, default: true },
    displayOrder: { type: Number, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("WorkingDay", workingDaySchema);
