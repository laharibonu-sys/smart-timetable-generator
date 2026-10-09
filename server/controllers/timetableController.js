"use strict";
const mongoose = require("mongoose");
const Timetable = require("../models/Timetable");
const AuditLog  = require("../models/AuditLog");
const Subject   = require("../models/Subject");
const Faculty   = require("../models/Faculty");
const Classroom = require("../models/Classroom");
const Section   = require("../models/Section");
const WorkingDay= require("../models/WorkingDay");
const TimeSlot  = require("../models/TimeSlot");
const Department= require("../models/Department");
const { generateTimetable, validateTimetable } = require("../services/timetableGenerator");
const { validateTimetableFull } = require("../services/timetableValidator");

const createError = (msg, status = 400) => { const e = new Error(msg); e.statusCode = status; return e; };

const POPULATE_ENTRIES = [
  { path: "entries.subject",   select: "name code subjectType weeklyHours requiredRoomType" },
  { path: "entries.faculty",   select: "name employeeId email" },
  { path: "entries.classroom", select: "roomNumber building roomType capacity" },
  { path: "entries.section",   select: "name" },
  { path: "entries.timeSlot",  select: "slotName startTime endTime slotType" },
  { path: "entries.additionalSlots", select: "slotName startTime endTime" },
];

async function populateFull(id) {
  return Timetable.findById(id)
    .populate("department", "name code")
    .populate("section", "name academicYear semester studentCount")
    .populate("createdBy", "name email")
    .populate("publishedBy", "name email")
    .populate("archivedBy", "name email")
    .populate(POPULATE_ENTRIES);
}

async function log(timetableId, action, userId, extra = {}) {
  await AuditLog.create({ timetable: timetableId, action, performedBy: userId, ...extra });
}

// ── POST /api/timetables/generate ────────────────────────────────────────────
const generate = async (req, res, next) => {
  try {
    const { sectionId, academicYear, semester } = req.body;
    if (!sectionId || !academicYear || !semester)
      return next(createError("sectionId, academicYear, and semester are required"));

    const section = await Section.findById(sectionId).populate("department");
    if (!section) return next(createError("Section not found", 404));

    const existingPublished = await Timetable.findOne({
      section: sectionId, academicYear, semester: Number(semester), status: "published",
    });
    if (existingPublished)
      return next(createError("A published timetable already exists. Use regenerate to create a new draft."));

    const subjects = await Subject.find({ department: section.department._id, semester: Number(semester), isActive: true });
    if (!subjects.length) return next(createError(`No active subjects for ${section.department.name}, Semester ${semester}.`));

    const [faculty, classrooms, workingDayDocs, timeSlots] = await Promise.all([
      Faculty.find({ isActive: true }).populate("subjects"),
      Classroom.find({ isAvailable: true }),
      WorkingDay.find({ isWorkingDay: true }).sort({ displayOrder: 1 }),
      TimeSlot.find({ isActive: true }).sort({ startTime: 1 }),
    ]);
    const workingDays = workingDayDocs.map((d) => d.dayName);
    if (!workingDays.length) return next(createError("No working days configured."));
    const teachingSlots = timeSlots.filter((s) => s.slotType !== "Break");
    if (!teachingSlots.length) return next(createError("No active teaching time slots found."));

    const result = await generateTimetable({ section, subjects, faculty, classrooms, workingDays, timeSlots });
    const violations = validateTimetable(result.entries, timeSlots);
    if (violations.length)
      return res.status(422).json({ success: false, message: "Generated timetable has constraint violations.", violations });

    const timetable = await Timetable.create({
      department: section.department._id, academicYear, semester: Number(semester), section: sectionId,
      status: "draft", entries: result.entries, unscheduledTasks: result.unscheduledTasks,
      statistics: result.statistics,
      generationConfig: { workingDays, timeSlotIds: teachingSlots.map((s) => s._id) },
      createdBy: req.user._id, version: 1,
    });

    await log(timetable._id, "generated", req.user._id);
    const populated = await populateFull(timetable._id);
    res.status(201).json({
      success: true, status: "draft",
      message: result.statistics.unscheduledTasks === 0
        ? "Timetable draft generated successfully."
        : `Draft generated. ${result.statistics.unscheduledTasks} subject(s) could not be fully scheduled.`,
      statistics: result.statistics, data: populated,
    });
  } catch (err) { next(err); }
};

// ── GET /api/timetables ───────────────────────────────────────────────────────
const getAll = async (req, res, next) => {
  try {
    const { department, semester, academicYear, status, section, search } = req.query;
    const filter = {};
    if (department)   filter.department   = department;
    if (semester)     filter.semester     = Number(semester);
    if (academicYear) filter.academicYear = academicYear;
    if (status)       filter.status       = status;
    if (section)      filter.section      = section;

    const timetables = await Timetable.find(filter)
      .populate("department", "name code")
      .populate("section", "name academicYear semester")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    // summary counts
    const all = await Timetable.find({});
    const counts = { total: all.length, draft: 0, published: 0, archived: 0, failed: 0, totalEntries: 0 };
    let lastGenerated = null;
    all.forEach((t) => {
      counts[t.status] = (counts[t.status] || 0) + 1;
      counts.totalEntries += t.entries?.length || 0;
      if (!lastGenerated || t.createdAt > lastGenerated.createdAt) lastGenerated = t;
    });

    res.json({ success: true, data: timetables, counts, lastGenerated: lastGenerated?._id || null });
  } catch (err) { next(err); }
};

// ── GET /api/timetables/:id ───────────────────────────────────────────────────
const getOne = async (req, res, next) => {
  try {
    const timetable = await populateFull(req.params.id);
    if (!timetable) return next(createError("Timetable not found", 404));
    res.json({ success: true, data: timetable });
  } catch (err) { next(err); }
};

// ── POST /api/timetables/:id/validate ────────────────────────────────────────
const validate = async (req, res, next) => {
  try {
    const timetable = await Timetable.findById(req.params.id)
      .populate({ path: "entries.subject",   select: "name code subjectType weeklyHours requiredRoomType" })
      .populate({ path: "entries.faculty",   select: "name employeeId isActive subjects maxWeeklyHours" })
      .populate({ path: "entries.classroom", select: "roomNumber roomType capacity isAvailable" })
      .populate({ path: "entries.section",   select: "name studentCount" })
      .populate({ path: "entries.timeSlot",  select: "slotName startTime endTime slotType isActive" })
      .populate({ path: "entries.additionalSlots", select: "slotName startTime endTime slotType isActive" })
      .populate("section", "studentCount");
    if (!timetable) return next(createError("Timetable not found", 404));

    const [allSlots, allFaculty, allRooms, workingDayDocs, allSubjects] = await Promise.all([
      TimeSlot.find({ isActive: true }),
      Faculty.find({ isActive: true }).populate("subjects"),
      Classroom.find({}),
      WorkingDay.find({ isWorkingDay: true }),
      Subject.find({ department: timetable.department, semester: timetable.semester, isActive: true }),
    ]);

    const result = validateTimetableFull({
      entries: timetable.entries, allSlots, allFaculty, allRooms, allSubjects,
      enabledDays: workingDayDocs.map((d) => d.dayName),
      studentCount: timetable.section?.studentCount || 0,
    });

    // Persist validation summary
    await Timetable.findByIdAndUpdate(req.params.id, {
      validationSummary: { valid: result.valid, errorCount: result.errorCount, warningCount: result.warningCount, checkedAt: new Date() },
    });
    await log(timetable._id, "validated", req.user._id, { note: `errors:${result.errorCount} warnings:${result.warningCount}` });

    res.json({
      success: true, valid: result.valid,
      totalChecked: result.totalChecked, errorCount: result.errorCount, warningCount: result.warningCount,
      conflicts: result.conflicts, byType: result.byType,
      message: result.valid
        ? `Timetable passes all checks. ${result.warningCount} warning(s).`
        : `Found ${result.errorCount} error(s) and ${result.warningCount} warning(s).`,
    });
  } catch (err) { next(err); }
};

// ── POST /api/timetables/check-entry ─────────────────────────────────────────
const checkEntry = async (req, res, next) => {
  try {
    const { subjectId, facultyId, classroomId, sectionId, day, timeSlotId, isLabSession, additionalSlotIds, excludeEntryId } = req.body;
    if (!subjectId || !facultyId || !classroomId || !sectionId || !day || !timeSlotId)
      return next(createError("subjectId, facultyId, classroomId, sectionId, day, and timeSlotId are required"));

    const allTimetables = await Timetable.find({}).select("entries");
    const allEntries = allTimetables.flatMap((t) => t.entries);

    const [subject, faculty, classroom, section, timeSlot, workingDayDocs, allSlots] = await Promise.all([
      Subject.findById(subjectId), Faculty.findById(facultyId).populate("subjects"),
      Classroom.findById(classroomId), Section.findById(sectionId),
      TimeSlot.findById(timeSlotId), WorkingDay.find({ isWorkingDay: true }), TimeSlot.find({ isActive: true }),
    ]);
    if (!subject)   return next(createError("Subject not found", 404));
    if (!faculty)   return next(createError("Faculty not found", 404));
    if (!classroom) return next(createError("Classroom not found", 404));
    if (!section)   return next(createError("Section not found", 404));
    if (!timeSlot)  return next(createError("Time slot not found", 404));

    const proposedEntry = {
      _id: excludeEntryId || "proposed", subject, faculty, classroom, section, day, timeSlot,
      isLabSession: !!isLabSession,
      additionalSlots: additionalSlotIds ? allSlots.filter((s) => additionalSlotIds.includes(String(s._id))) : [],
    };
    const checkEntries = [...allEntries, proposedEntry];
    const result = validateTimetableFull({
      entries: checkEntries, allSlots, allFaculty: [faculty], allRooms: [classroom],
      allSubjects: [subject], enabledDays: workingDayDocs.map((d) => d.dayName),
      studentCount: section.studentCount || 0, excludeEntryId: excludeEntryId || null,
    });
    const proposedIdx = checkEntries.length - 1;
    const relevant = result.conflicts.filter(
      (c) => c.entryIndex === proposedIdx || c.entryIndexA === proposedIdx || c.entryIndexB === proposedIdx
    );
    res.json({
      success: true,
      valid: relevant.length === 0 || relevant.every((c) => c.severity !== "error"),
      conflicts: relevant,
      message: relevant.length === 0 ? "No conflicts." : `${relevant.filter((c) => c.severity === "error").length} conflict(s).`,
    });
  } catch (err) { next(err); }
};

// ── PATCH /api/timetables/:id/publish ────────────────────────────────────────
const publish = async (req, res, next) => {
  try {
    const timetable = await Timetable.findById(req.params.id);
    if (!timetable) return next(createError("Timetable not found", 404));
    if (timetable.status === "published") return next(createError("Already published"));
    if (timetable.status === "archived")  return next(createError("Cannot publish an archived timetable. Restore it first."));

    const [allSlots, allFaculty, allRooms, workingDayDocs, allSubjects, sectionDoc] = await Promise.all([
      TimeSlot.find({ isActive: true }), Faculty.find({ isActive: true }).populate("subjects"),
      Classroom.find({}), WorkingDay.find({ isWorkingDay: true }),
      Subject.find({ department: timetable.department, semester: timetable.semester, isActive: true }),
      Section.findById(timetable.section),
    ]);
    const result = validateTimetableFull({
      entries: timetable.entries, allSlots, allFaculty, allRooms, allSubjects,
      enabledDays: workingDayDocs.map((d) => d.dayName),
      studentCount: sectionDoc?.studentCount || 0,
    });
    if (!result.valid)
      return next(createError(`Cannot publish: ${result.errorCount} hard constraint violation(s). Run Validate first.`));
    if (timetable.statistics.unscheduledTasks > 0)
      return next(createError(`Cannot publish: ${timetable.statistics.unscheduledTasks} subject(s) unscheduled.`));

    timetable.status = "published";
    timetable.publishedAt = new Date();
    timetable.publishedBy = req.user._id;
    timetable.validationSummary = { valid: true, errorCount: 0, warningCount: result.warningCount, checkedAt: new Date() };
    await timetable.save();
    await log(timetable._id, "published", req.user._id);

    res.json({ success: true, message: "Timetable published successfully.", data: timetable });
  } catch (err) { next(err); }
};

// ── PATCH /api/timetables/:id/archive ────────────────────────────────────────
const archive = async (req, res, next) => {
  try {
    const timetable = await Timetable.findById(req.params.id);
    if (!timetable) return next(createError("Timetable not found", 404));
    if (timetable.status === "archived") return next(createError("Already archived"));

    timetable.status = "archived";
    timetable.archivedAt = new Date();
    timetable.archivedBy = req.user._id;
    await timetable.save();
    await log(timetable._id, "archived", req.user._id);

    res.json({ success: true, message: "Timetable archived.", data: timetable });
  } catch (err) { next(err); }
};

// ── PATCH /api/timetables/:id/restore ────────────────────────────────────────
const restore = async (req, res, next) => {
  try {
    const timetable = await Timetable.findById(req.params.id);
    if (!timetable) return next(createError("Timetable not found", 404));
    if (timetable.status !== "archived") return next(createError("Only archived timetables can be restored"));

    timetable.status = "draft";
    timetable.archivedAt = undefined;
    timetable.archivedBy = undefined;
    await timetable.save();
    await log(timetable._id, "restored", req.user._id);

    res.json({ success: true, message: "Timetable restored to draft.", data: timetable });
  } catch (err) { next(err); }
};

// ── PATCH /api/timetables/:id/assignments/:assignmentId ──────────────────────
const editAssignment = async (req, res, next) => {
  try {
    const { id, assignmentId } = req.params;
    const { subjectId, facultyId, classroomId, day, timeSlotId, isLabSession, additionalSlotIds } = req.body;

    const timetable = await Timetable.findById(id);
    if (!timetable) return next(createError("Timetable not found", 404));
    if (timetable.status === "archived") return next(createError("Cannot edit an archived timetable."));
    if (timetable.status === "published")
      return next(createError("Cannot edit a published timetable directly. Archive it, restore as draft, then edit."));

    const entry = timetable.entries.id(assignmentId);
    if (!entry) return next(createError("Assignment not found", 404));

    // Validate all provided IDs exist
    const [subject, faculty, classroom, timeSlot, workingDayDocs, allSlots] = await Promise.all([
      subjectId   ? Subject.findById(subjectId)   : Promise.resolve(null),
      facultyId   ? Faculty.findById(facultyId).populate("subjects") : Promise.resolve(null),
      classroomId ? Classroom.findById(classroomId) : Promise.resolve(null),
      timeSlotId  ? TimeSlot.findById(timeSlotId)   : Promise.resolve(null),
      WorkingDay.find({ isWorkingDay: true }),
      TimeSlot.find({ isActive: true }),
    ]);
    if (subjectId   && !subject)   return next(createError("Subject not found", 404));
    if (facultyId   && !faculty)   return next(createError("Faculty not found", 404));
    if (classroomId && !classroom) return next(createError("Classroom not found", 404));
    if (timeSlotId  && !timeSlot)  return next(createError("Time slot not found", 404));

    // Build proposed entry for conflict check (merge old + new values)
    const sectionDoc = await Section.findById(timetable.section);
    const resolvedSubject   = subject   || await Subject.findById(entry.subject);
    const resolvedFaculty   = faculty   || await Faculty.findById(entry.faculty).populate("subjects");
    const resolvedClassroom = classroom || await Classroom.findById(entry.classroom);
    const resolvedTimeSlot  = timeSlot  || await TimeSlot.findById(entry.timeSlot);
    const resolvedDay       = day       || entry.day;

    // All entries from ALL timetables except this one entry
    const allTimetables = await Timetable.find({}).select("entries");
    const allEntries = allTimetables.flatMap((t) =>
      t._id.equals(id) ? t.entries.filter((e) => String(e._id) !== assignmentId) : t.entries
    );

    const proposedEntry = {
      _id: assignmentId, subject: resolvedSubject, faculty: resolvedFaculty,
      classroom: resolvedClassroom, section: sectionDoc, day: resolvedDay,
      timeSlot: resolvedTimeSlot, isLabSession: isLabSession ?? entry.isLabSession,
      additionalSlots: additionalSlotIds
        ? allSlots.filter((s) => additionalSlotIds.includes(String(s._id)))
        : entry.additionalSlots,
    };

    const checkEntries = [...allEntries, proposedEntry];
    const allSubjects = await Subject.find({ department: timetable.department, semester: timetable.semester, isActive: true });
    const allFaculty  = await Faculty.find({ isActive: true }).populate("subjects");
    const allRooms    = await Classroom.find({});

    const result = validateTimetableFull({
      entries: checkEntries, allSlots, allFaculty, allRooms, allSubjects,
      enabledDays: workingDayDocs.map((d) => d.dayName),
      studentCount: sectionDoc?.studentCount || 0,
      excludeEntryId: assignmentId,
    });
    const proposedIdx = checkEntries.length - 1;
    const hardConflicts = result.conflicts.filter(
      (c) => c.severity === "error" &&
        (c.entryIndex === proposedIdx || c.entryIndexA === proposedIdx || c.entryIndexB === proposedIdx)
    );
    if (hardConflicts.length)
      return res.status(422).json({ success: false, message: hardConflicts[0].message, conflicts: hardConflicts });

    // Save previous values for audit
    const previousValues = {
      subject: entry.subject, faculty: entry.faculty, classroom: entry.classroom,
      day: entry.day, timeSlot: entry.timeSlot, isLabSession: entry.isLabSession,
    };

    // Apply changes
    if (subjectId)   entry.subject   = subjectId;
    if (facultyId)   entry.faculty   = facultyId;
    if (classroomId) entry.classroom = classroomId;
    if (day)         entry.day       = day;
    if (timeSlotId)  entry.timeSlot  = timeSlotId;
    if (isLabSession !== undefined) entry.isLabSession = isLabSession;
    if (additionalSlotIds) entry.additionalSlots = additionalSlotIds;

    await timetable.save();
    await log(id, "assignment_edited", req.user._id, {
      assignmentId, previousValues,
      newValues: { subject: entry.subject, faculty: entry.faculty, classroom: entry.classroom, day: entry.day, timeSlot: entry.timeSlot },
    });

    const populated = await populateFull(id);
    res.json({ success: true, message: "Assignment updated successfully.", data: populated });
  } catch (err) { next(err); }
};

// ── POST /api/timetables/:id/regenerate ──────────────────────────────────────
const regenerate = async (req, res, next) => {
  try {
    const existing = await Timetable.findById(req.params.id).populate("section");
    if (!existing) return next(createError("Timetable not found", 404));

    const { section, academicYear, semester } = existing;

    // Delete only drafts — never touch published or archived
    await Timetable.deleteMany({ section: section._id, academicYear, semester, status: "draft" });

    const sectionDoc = await Section.findById(section._id).populate("department");
    const subjects = await Subject.find({ department: sectionDoc.department._id, semester, isActive: true });
    if (!subjects.length) return next(createError(`No active subjects for Semester ${semester}.`));

    const [faculty, classrooms, workingDayDocs, timeSlots] = await Promise.all([
      Faculty.find({ isActive: true }).populate("subjects"),
      Classroom.find({ isAvailable: true }),
      WorkingDay.find({ isWorkingDay: true }).sort({ displayOrder: 1 }),
      TimeSlot.find({ isActive: true }).sort({ startTime: 1 }),
    ]);
    const workingDays = workingDayDocs.map((d) => d.dayName);
    if (!workingDays.length) return next(createError("No working days configured."));
    const teachingSlots = timeSlots.filter((s) => s.slotType !== "Break");
    if (!teachingSlots.length) return next(createError("No active teaching time slots found."));

    const result = await generateTimetable({ section: sectionDoc, subjects, faculty, classrooms, workingDays, timeSlots });
    const violations = validateTimetable(result.entries, timeSlots);
    if (violations.length)
      return res.status(422).json({ success: false, message: "Regenerated timetable has constraint violations.", violations });

    // Find current published version to link as previousTimetable
    const currentPublished = await Timetable.findOne({ section: section._id, academicYear, semester, status: "published" });

    const newTimetable = await Timetable.create({
      department: sectionDoc.department._id, academicYear, semester, section: section._id,
      status: "draft", entries: result.entries, unscheduledTasks: result.unscheduledTasks,
      statistics: result.statistics,
      generationConfig: { workingDays, timeSlotIds: teachingSlots.map((s) => s._id) },
      createdBy: req.user._id,
      previousTimetable: currentPublished?._id || existing._id,
      version: (existing.version || 1) + 1,
    });

    await log(newTimetable._id, "regenerated", req.user._id, { note: `replaced:${existing._id}` });
    const populated = await populateFull(newTimetable._id);
    res.status(201).json({
      success: true, status: "draft",
      message: result.statistics.unscheduledTasks === 0
        ? "Timetable regenerated successfully as new draft."
        : `Regenerated. ${result.statistics.unscheduledTasks} subject(s) could not be fully scheduled.`,
      statistics: result.statistics, data: populated,
    });
  } catch (err) { next(err); }
};

// ── DELETE /api/timetables/:id ────────────────────────────────────────────────
const remove = async (req, res, next) => {
  try {
    const timetable = await Timetable.findById(req.params.id);
    if (!timetable) return next(createError("Timetable not found", 404));
    if (timetable.status === "published")
      return next(createError("Cannot delete a published timetable. Archive it first."));
    await timetable.deleteOne();
    res.json({ success: true, message: "Timetable deleted." });
  } catch (err) { next(err); }
};

// ── GET /api/timetables/:id/export/csv ───────────────────────────────────────
const exportCSV = async (req, res, next) => {
  try {
    const timetable = await populateFull(req.params.id);
    if (!timetable) return next(createError("Timetable not found", 404));

    const headers = ["TimetableID","Department","AcademicYear","Semester","Section","Day","StartTime","EndTime","SubjectCode","SubjectName","SubjectType","FacultyName","Classroom","Status"];
    const rows = timetable.entries.map((e) => [
      timetable._id,
      timetable.department?.name || "",
      timetable.academicYear,
      timetable.semester,
      timetable.section?.name || "",
      e.day,
      e.timeSlot?.startTime || "",
      e.timeSlot?.endTime   || "",
      e.subject?.code       || "",
      e.subject?.name       || "",
      e.subject?.subjectType|| "",
      e.faculty?.name       || "",
      e.classroom?.roomNumber || "",
      timetable.status,
    ]);

    const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((r) => r.map(escape).join(",")).join("\r\n");
    const filename = `${timetable.department?.name || "Dept"}_Sem${timetable.semester}_${timetable.section?.name || "Section"}_Timetable.csv`
      .replace(/\s+/g, "_");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send("\uFEFF" + csv); // BOM for Excel UTF-8
  } catch (err) { next(err); }
};

// ── GET /api/timetables/:id/audit ────────────────────────────────────────────
const getAuditLog = async (req, res, next) => {
  try {
    const logs = await AuditLog.find({ timetable: req.params.id })
      .populate("performedBy", "name email")
      .sort({ createdAt: -1 });
    res.json({ success: true, data: logs });
  } catch (err) { next(err); }
};

// ── GET /api/timetables/readiness ─────────────────────────────────────────────
const getReadiness = async (req, res, next) => {
  try {
    const { sectionId, semester } = req.query;
    if (!sectionId || !semester) return next(createError("sectionId and semester are required"));
    const section = await Section.findById(sectionId).populate("department");
    if (!section) return next(createError("Section not found", 404));

    const [subjects, faculty, classrooms, workingDays, timeSlots] = await Promise.all([
      Subject.find({ department: section.department._id, semester: Number(semester), isActive: true }),
      Faculty.find({ isActive: true }).populate("subjects"),
      Classroom.find({ isAvailable: true }),
      WorkingDay.find({ isWorkingDay: true }),
      TimeSlot.find({ isActive: true, slotType: { $ne: "Break" } }),
    ]);
    const totalWeeklyHours = subjects.reduce((s, sub) => s + sub.weeklyHours, 0);
    const totalSlots = workingDays.length * timeSlots.length;
    const issues = [];
    for (const sub of subjects) {
      if (!faculty.some((f) => f.subjects.some((s) => String(s._id || s) === String(sub._id))))
        issues.push(`"${sub.name}" has no eligible faculty assigned.`);
      if (!classrooms.some((r) => r.isAvailable && (sub.requiredRoomType === "Any" || r.roomType === sub.requiredRoomType) && r.capacity >= section.studentCount))
        issues.push(`"${sub.name}" has no suitable room (${sub.requiredRoomType}, capacity ≥ ${section.studentCount}).`);
    }
    if (!workingDays.length) issues.push("No working days configured.");
    if (!timeSlots.length)   issues.push("No active teaching time slots configured.");
    if (totalWeeklyHours > totalSlots) issues.push(`Weekly hours (${totalWeeklyHours}) exceeds available slots (${totalSlots}).`);

    res.json({ success: true, data: {
      subjectCount: subjects.length, totalWeeklyHours, facultyCount: faculty.length,
      classroomCount: classrooms.length, teachingSlotCount: timeSlots.length,
      workingDayCount: workingDays.length, totalAvailableSlots: totalSlots,
      issues, isReady: issues.length === 0 && subjects.length > 0,
    }});
  } catch (err) { next(err); }
};

// ── GET /api/timetables/my-schedule ──────────────────────────────────────────
const getMySchedule = async (req, res, next) => {
  try {
    if (!req.user.facultyRef) return next(createError("Account not linked to a faculty record.", 404));
    const { day } = req.query;
    const facultyId = String(req.user.facultyRef);
    const timetables = await Timetable.find({ status: "published" })
      .populate("department", "name code").populate("section", "name academicYear semester")
      .populate({ path: "entries.subject",   select: "name code subjectType weeklyHours" })
      .populate({ path: "entries.faculty",   select: "name employeeId" })
      .populate({ path: "entries.classroom", select: "roomNumber building roomType" })
      .populate({ path: "entries.section",   select: "name" })
      .populate({ path: "entries.timeSlot",  select: "slotName startTime endTime slotType" });

    const mySchedule = timetables.map((tt) => ({
      ...tt.toObject(),
      entries: tt.entries.filter((e) => {
        if (String(e.faculty?._id || e.faculty) !== facultyId) return false;
        if (day && e.day !== day) return false;
        return true;
      }),
    })).filter((tt) => tt.entries.length > 0);

    const allEntries = mySchedule.flatMap((tt) => tt.entries);
    const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
    res.json({ success: true, data: mySchedule, stats: {
      totalClasses: allEntries.length,
      classesToday: allEntries.filter((e) => e.day === today).length,
      sectionsCount: [...new Set(mySchedule.map((tt) => tt.section?.name).filter(Boolean))].length,
      today,
    }});
  } catch (err) { next(err); }
};

// ── GET /api/timetables/my-section ───────────────────────────────────────────
const getMySection = async (req, res, next) => {
  try {
    if (!req.user.sectionRef) return next(createError("Account not linked to a section.", 404));
    const { day } = req.query;
    const timetable = await Timetable.findOne({ section: String(req.user.sectionRef), status: "published" })
      .populate("department", "name code").populate("section", "name academicYear semester studentCount")
      .populate({ path: "entries.subject",   select: "name code subjectType weeklyHours" })
      .populate({ path: "entries.faculty",   select: "name employeeId" })
      .populate({ path: "entries.classroom", select: "roomNumber building roomType" })
      .populate({ path: "entries.timeSlot",  select: "slotName startTime endTime slotType" });

    const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
    if (!timetable) return res.json({ success: true, data: null, stats: { totalClasses: 0, classesToday: 0, today } });

    const entries = day ? timetable.toObject().entries.filter((e) => e.day === day) : timetable.toObject().entries;
    res.json({ success: true, data: { ...timetable.toObject(), entries }, stats: {
      totalClasses: timetable.entries.length,
      classesToday: timetable.entries.filter((e) => e.day === today).length,
      today,
    }});
  } catch (err) { next(err); }
};

// ── GET /api/timetables/view ──────────────────────────────────────────────────
const viewTimetables = async (req, res, next) => {
  try {
    const { department, semester, academicYear, section, faculty, classroom, subject, day } = req.query;
    const filter = { status: "published" };
    if (department)   filter.department   = department;
    if (semester)     filter.semester     = Number(semester);
    if (academicYear) filter.academicYear = academicYear;
    if (section)      filter.section      = section;

    let timetables = await Timetable.find(filter)
      .populate("department", "name code").populate("section", "name academicYear semester studentCount")
      .populate({ path: "entries.subject",   select: "name code subjectType weeklyHours" })
      .populate({ path: "entries.faculty",   select: "name employeeId" })
      .populate({ path: "entries.classroom", select: "roomNumber building roomType" })
      .populate({ path: "entries.timeSlot",  select: "slotName startTime endTime slotType" })
      .sort({ createdAt: -1 });

    if (faculty || classroom || subject || day) {
      timetables = timetables.map((tt) => ({
        ...tt.toObject(),
        entries: tt.entries.filter((e) => {
          if (faculty   && String(e.faculty?._id   || e.faculty)   !== faculty)   return false;
          if (classroom && String(e.classroom?._id || e.classroom) !== classroom) return false;
          if (subject   && String(e.subject?._id   || e.subject)   !== subject)   return false;
          if (day       && e.day !== day) return false;
          return true;
        }),
      })).filter((tt) => tt.entries.length > 0);
    }
    res.json({ success: true, count: timetables.length, data: timetables });
  } catch (err) { next(err); }
};

module.exports = {
  generate, getAll, getOne, validate, checkEntry,
  publish, archive, restore,
  editAssignment, regenerate, remove,
  exportCSV, getAuditLog,
  getReadiness, getMySchedule, getMySection, viewTimetables,
};
