const mongoose = require("mongoose");

// A single scheduled class entry
const scheduleEntrySchema = new mongoose.Schema({
  subject:   { type: mongoose.Schema.Types.ObjectId, ref: "Subject",   required: true },
  faculty:   { type: mongoose.Schema.Types.ObjectId, ref: "Faculty",   required: true },
  classroom: { type: mongoose.Schema.Types.ObjectId, ref: "Classroom", required: true },
  section:   { type: mongoose.Schema.Types.ObjectId, ref: "Section",   required: true },
  day: { type: String, required: true, enum: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"] },
  timeSlot:        { type: mongoose.Schema.Types.ObjectId, ref: "TimeSlot", required: true },
  additionalSlots: [{ type: mongoose.Schema.Types.ObjectId, ref: "TimeSlot" }],
  isLabSession:    { type: Boolean, default: false },
}, { _id: true });

const unscheduledTaskSchema = new mongoose.Schema({
  subject:         { type: mongoose.Schema.Types.ObjectId, ref: "Subject" },
  subjectName:     { type: String },
  subjectCode:     { type: String },
  reason:          { type: String },
  periodsNeeded:   { type: Number },
  periodsScheduled:{ type: Number, default: 0 },
}, { _id: false });

const timetableSchema = new mongoose.Schema({
  name:         { type: String, trim: true },          // optional human-readable label
  department:   { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true },
  academicYear: { type: String, required: true, trim: true },
  semester:     { type: Number, required: true, min: 1, max: 8 },
  section:      { type: mongoose.Schema.Types.ObjectId, ref: "Section", required: true },

  status: { type: String, enum: ["draft", "published", "archived", "failed"], default: "draft" },

  entries:          [scheduleEntrySchema],
  unscheduledTasks: [unscheduledTaskSchema],

  statistics: {
    requiredTasks:          { type: Number, default: 0 },
    scheduledTasks:         { type: Number, default: 0 },
    unscheduledTasks:       { type: Number, default: 0 },
    totalConflictsDetected: { type: Number, default: 0 },
    qualityScore:           { type: Number, default: 0 },
    generationTimeMs:       { type: Number, default: 0 },
  },

  validationSummary: {
    valid:        { type: Boolean, default: null },
    errorCount:   { type: Number,  default: 0 },
    warningCount: { type: Number,  default: 0 },
    checkedAt:    { type: Date,    default: null },
  },

  generationConfig: {
    workingDays: [String],
    timeSlotIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "TimeSlot" }],
  },

  // Lifecycle metadata
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  publishedAt: { type: Date },
  publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  archivedAt:  { type: Date },
  archivedBy:  { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  // Link to the timetable this one replaces (set during regeneration)
  previousTimetable: { type: mongoose.Schema.Types.ObjectId, ref: "Timetable", default: null },

  version: { type: Number, default: 1 },
  notes:   { type: String },
}, { timestamps: true });

timetableSchema.index({ section: 1, semester: 1, academicYear: 1, status: 1 });

module.exports = mongoose.model("Timetable", timetableSchema);
