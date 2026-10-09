const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema({
  timetable: { type: mongoose.Schema.Types.ObjectId, ref: "Timetable", required: true },
  action: {
    type: String,
    required: true,
    enum: ["generated", "validated", "published", "archived", "restored", "regenerated", "assignment_edited", "deleted"],
  },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  assignmentId: { type: mongoose.Schema.Types.ObjectId, default: null },
  previousValues: { type: mongoose.Schema.Types.Mixed, default: null },
  newValues:      { type: mongoose.Schema.Types.Mixed, default: null },
  note:           { type: String, default: "" },
}, { timestamps: true });

auditLogSchema.index({ timetable: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
