const mongoose = require("mongoose");

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Department name is required"], trim: true },
    code: { type: String, required: [true, "Department code is required"], unique: true, uppercase: true, trim: true },
    description: { type: String, trim: true },
    hodName: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Department", departmentSchema);
