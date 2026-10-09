"use strict";

/**
 * reportController.js
 *
 * All analytics are computed from real MongoDB data.
 * No values are hardcoded or fabricated.
 *
 * Source-of-truth rules:
 *  - "Active" timetables = published (default) or draft when explicitly requested.
 *  - Archived timetables are excluded from current stats unless ?includeArchived=true.
 *  - When multiple timetables exist for the same section/semester/year, only the
 *    published one is used; if none is published, the most-recent draft is used.
 *  - Conflict deduplication: conflicts are keyed by (type + sorted resource IDs + day + time).
 */

const mongoose = require("mongoose");
const Timetable  = require("../models/Timetable");
const Subject    = require("../models/Subject");
const Faculty    = require("../models/Faculty");
const Classroom  = require("../models/Classroom");
const Department = require("../models/Department");
const Section    = require("../models/Section");
const WorkingDay = require("../models/WorkingDay");
const TimeSlot   = require("../models/TimeSlot");
const { validateTimetableFull } = require("../services/timetableValidator");

const createError = (msg, status = 400) => { const e = new Error(msg); e.statusCode = status; return e; };

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse minutes from "HH:MM" */
const toMin = (t) => { const [h, m] = (t || "00:00").split(":").map(Number); return h * 60 + m; };

/** Duration in hours between two "HH:MM" strings */
const slotHours = (start, end) => Math.max(0, (toMin(end) - toMin(start)) / 60);

/** Safe ObjectId check */
const isOid = (v) => mongoose.Types.ObjectId.isValid(v);

/** Build a timetable filter from query params */
function buildTtFilter(query) {
  const { department, semester, academicYear, section, status, includeArchived } = query;
  const filter = {};
  if (department   && isOid(department))   filter.department   = department;
  if (semester)                             filter.semester     = Number(semester);
  if (academicYear)                         filter.academicYear = academicYear;
  if (section      && isOid(section))       filter.section      = section;

  // Status logic: default = published only; allow draft; exclude archived unless requested
  if (status) {
    filter.status = status;
  } else if (includeArchived === "true") {
    filter.status = { $in: ["published", "draft", "archived"] };
  } else {
    filter.status = { $in: ["published", "draft"] };
  }
  return filter;
}

/**
 * Deduplicate conflicts by a stable key so the same underlying issue
 * is not counted twice across different check functions.
 */
function deduplicateConflicts(conflicts) {
  const seen = new Set();
  return conflicts.filter((c) => {
    const ids = [c.resourceId, c.entryIndex, c.entryIndexA, c.entryIndexB]
      .filter((v) => v != null)
      .map(String)
      .sort()
      .join("|");
    const key = `${c.type}|${c.day || ""}|${c.startTime || ""}|${ids}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Pick the "active" timetable per (section, semester, academicYear):
 * published > most-recent draft. Ignores archived.
 */
function pickActiveTimetables(timetables) {
  const map = new Map();
  for (const tt of timetables) {
    const key = `${tt.section}|${tt.semester}|${tt.academicYear}`;
    const existing = map.get(key);
    if (!existing) { map.set(key, tt); continue; }
    // published beats draft
    if (tt.status === "published" && existing.status !== "published") { map.set(key, tt); continue; }
    // same status → keep newer
    if (tt.status === existing.status && tt.createdAt > existing.createdAt) { map.set(key, tt); }
  }
  return [...map.values()];
}

// ─── GET /api/reports/summary ─────────────────────────────────────────────────
const getSummary = async (req, res, next) => {
  try {
    const ttFilter = buildTtFilter(req.query);
    const timetables = await Timetable.find(ttFilter).lean();
    const active = pickActiveTimetables(timetables);

    let totalRequired = 0, totalScheduled = 0, totalUnscheduled = 0;
    for (const tt of active) {
      totalRequired   += tt.statistics?.requiredTasks   || 0;
      totalScheduled  += tt.statistics?.scheduledTasks  || 0;
      totalUnscheduled += tt.statistics?.unscheduledTasks || 0;
    }

    // Conflict count: run validator on each active timetable
    const [allSlots, allFaculty, allRooms, workingDayDocs] = await Promise.all([
      TimeSlot.find({ isActive: true }).lean(),
      Faculty.find({ isActive: true }).populate("subjects").lean(),
      Classroom.find({}).lean(),
      WorkingDay.find({ isWorkingDay: true }).lean(),
    ]);
    const enabledDays = workingDayDocs.map((d) => d.dayName);

    let totalConflicts = 0, totalWarnings = 0;
    for (const tt of active) {
      const sectionDoc = await Section.findById(tt.section).lean();
      const allSubjects = await Subject.find({ department: tt.department, semester: tt.semester, isActive: true }).lean();
      const result = validateTimetableFull({
        entries: tt.entries, allSlots, allFaculty, allRooms, allSubjects,
        enabledDays, studentCount: sectionDoc?.studentCount || 0,
      });
      const deduped = deduplicateConflicts(result.conflicts);
      totalConflicts += deduped.filter((c) => c.severity === "error").length;
      totalWarnings  += deduped.filter((c) => c.severity === "warning").length;
    }

    const [activeFaculty, availableRooms, publishedCount] = await Promise.all([
      Faculty.countDocuments({ isActive: true }),
      Classroom.countDocuments({ isAvailable: true }),
      Timetable.countDocuments({ status: "published" }),
    ]);

    res.json({
      success: true,
      data: {
        totalRequired,
        totalScheduled,
        totalUnscheduled,
        schedulingRate: totalRequired > 0 ? Math.round((totalScheduled / totalRequired) * 100) : 0,
        totalConflicts,
        totalWarnings,
        activeFaculty,
        availableRooms,
        publishedTimetables: publishedCount,
        activeTimetablesInScope: active.length,
      },
    });
  } catch (err) { next(err); }
};

// ─── GET /api/reports/faculty-workload ────────────────────────────────────────
const getFacultyWorkload = async (req, res, next) => {
  try {
    const { department, semester, academicYear, section, facultyId } = req.query;
    const ttFilter = buildTtFilter(req.query);
    const timetables = await Timetable.find(ttFilter).lean();
    const active = pickActiveTimetables(timetables);

    // Load all time slots once for duration lookup
    const allSlots = await TimeSlot.find({}).lean();
    const slotMap = new Map(allSlots.map((s) => [String(s._id), s]));

    // Accumulate per-faculty stats
    const stats = new Map(); // facultyId → { classes, hours, subjects, sections }

    for (const tt of active) {
      for (const entry of tt.entries) {
        const fid = String(entry.faculty);
        if (!stats.has(fid)) stats.set(fid, { classes: 0, hours: 0, subjects: new Set(), sections: new Set() });
        const s = stats.get(fid);
        s.classes++;
        s.subjects.add(String(entry.subject));
        s.sections.add(String(entry.section));

        // Calculate actual duration from slot
        const slot = slotMap.get(String(entry.timeSlot));
        if (slot) {
          const h = slotHours(slot.startTime, slot.endTime);
          s.hours += h;
          // Lab sessions span two slots
          if (entry.isLabSession && entry.additionalSlots?.length) {
            for (const addId of entry.additionalSlots) {
              const addSlot = slotMap.get(String(addId));
              if (addSlot) s.hours += slotHours(addSlot.startTime, addSlot.endTime);
            }
          }
        }
      }
    }

    // Build faculty query
    const facFilter = { isActive: true };
    if (department && isOid(department)) facFilter.department = department;
    if (facultyId  && isOid(facultyId))  facFilter._id = facultyId;

    const facultyList = await Faculty.find(facFilter)
      .populate("department", "name code")
      .populate("subjects", "name code")
      .lean();

    const rows = facultyList.map((f) => {
      const fid = String(f._id);
      const s = stats.get(fid) || { classes: 0, hours: 0, subjects: new Set(), sections: new Set() };
      const hours = Math.round(s.hours * 10) / 10;
      const max   = f.maxWeeklyHours || null;
      let workloadStatus = "No limit configured";
      if (max) {
        if (hours > max)          workloadStatus = "Overloaded";
        else if (hours === max)   workloadStatus = "At capacity";
        else                      workloadStatus = "Within limit";
      }
      return {
        _id:          fid,
        name:         f.name,
        employeeId:   f.employeeId,
        department:   f.department?.name || "—",
        departmentId: String(f.department?._id || ""),
        classes:      s.classes,
        weeklyHours:  hours,
        subjectCount: s.subjects.size,
        sectionCount: s.sections.size,
        maxWeeklyHours: max,
        remainingCapacity: max != null ? Math.max(0, max - hours) : null,
        workloadStatus,
      };
    });

    // Filter by semester/section if provided (only show faculty who teach in scope)
    const filtered = (semester || section)
      ? rows.filter((r) => stats.has(r._id))
      : rows;

    // Chart data: top 15 by hours
    const chartData = [...filtered]
      .sort((a, b) => b.weeklyHours - a.weeklyHours)
      .slice(0, 15)
      .map((r) => ({ name: r.name.split(" ").slice(-1)[0], fullName: r.name, hours: r.weeklyHours, max: r.maxWeeklyHours }));

    // Department summary
    const deptMap = new Map();
    for (const r of filtered) {
      const d = r.department;
      if (!deptMap.has(d)) deptMap.set(d, { department: d, faculty: 0, totalHours: 0, overloaded: 0 });
      const dm = deptMap.get(d);
      dm.faculty++;
      dm.totalHours += r.weeklyHours;
      if (r.workloadStatus === "Overloaded") dm.overloaded++;
    }
    const departmentSummary = [...deptMap.values()].map((d) => ({
      ...d, avgHours: d.faculty > 0 ? Math.round((d.totalHours / d.faculty) * 10) / 10 : 0,
    }));

    res.json({ success: true, data: { rows: filtered, chartData, departmentSummary } });
  } catch (err) { next(err); }
};

// ─── GET /api/reports/classroom-utilization ───────────────────────────────────
const getClassroomUtilization = async (req, res, next) => {
  try {
    const { department, semester, academicYear } = req.query;
    const ttFilter = buildTtFilter(req.query);
    const timetables = await Timetable.find(ttFilter).lean();
    const active = pickActiveTimetables(timetables);

    const [allSlots, workingDayDocs] = await Promise.all([
      TimeSlot.find({ isActive: true }).lean(),
      WorkingDay.find({ isWorkingDay: true }).lean(),
    ]);
    const slotMap = new Map(allSlots.map((s) => [String(s._id), s]));
    const teachingSlots = allSlots.filter((s) => s.slotType !== "Break");
    const workingDayCount = workingDayDocs.length;

    // Available hours per room per week = workingDays × sum(teaching slot durations)
    const weeklyAvailableHours = teachingSlots.reduce((sum, s) => sum + slotHours(s.startTime, s.endTime), 0) * workingDayCount;

    // Accumulate scheduled hours per classroom
    const roomStats = new Map(); // roomId → { classes, hours }
    for (const tt of active) {
      for (const entry of tt.entries) {
        const rid = String(entry.classroom);
        if (!roomStats.has(rid)) roomStats.set(rid, { classes: 0, hours: 0 });
        const rs = roomStats.get(rid);
        rs.classes++;
        const slot = slotMap.get(String(entry.timeSlot));
        if (slot) {
          rs.hours += slotHours(slot.startTime, slot.endTime);
          if (entry.isLabSession && entry.additionalSlots?.length) {
            for (const addId of entry.additionalSlots) {
              const addSlot = slotMap.get(String(addId));
              if (addSlot) rs.hours += slotHours(addSlot.startTime, addSlot.endTime);
            }
          }
        }
      }
    }

    const classrooms = await Classroom.find({}).lean();
    const rows = classrooms.map((room) => {
      const rid = String(room._id);
      const rs = roomStats.get(rid) || { classes: 0, hours: 0 };
      const scheduledHours = Math.round(rs.hours * 10) / 10;
      const availableHours = room.isAvailable ? Math.round(weeklyAvailableHours * 10) / 10 : 0;
      const utilPct = availableHours > 0 ? Math.min(100, Math.round((scheduledHours / availableHours) * 1000) / 10) : 0;
      const unusedSlots = availableHours > 0
        ? Math.max(0, Math.round(((availableHours - scheduledHours) / (teachingSlots.length > 0 ? teachingSlots.reduce((s, sl) => s + slotHours(sl.startTime, sl.endTime), 0) / teachingSlots.length : 1)) * 10) / 10)
        : 0;
      return {
        _id:            rid,
        roomNumber:     room.roomNumber,
        building:       room.building || "—",
        roomType:       room.roomType,
        capacity:       room.capacity,
        isAvailable:    room.isAvailable,
        scheduledHours,
        availableHours,
        utilizationPct: utilPct,
        classes:        rs.classes,
        unusedSlots:    Math.round(unusedSlots),
      };
    });

    // Chart: top 15 by utilization
    const chartData = [...rows]
      .filter((r) => r.isAvailable)
      .sort((a, b) => b.utilizationPct - a.utilizationPct)
      .slice(0, 15)
      .map((r) => ({ name: r.roomNumber, utilization: r.utilizationPct, type: r.roomType }));

    // Room-type summary
    const typeMap = new Map();
    for (const r of rows) {
      if (!typeMap.has(r.roomType)) typeMap.set(r.roomType, { type: r.roomType, count: 0, totalUtil: 0, totalHours: 0 });
      const tm = typeMap.get(r.roomType);
      tm.count++;
      tm.totalUtil  += r.utilizationPct;
      tm.totalHours += r.scheduledHours;
    }
    const typeData = [...typeMap.values()].map((t) => ({
      type: t.type, count: t.count,
      avgUtilization: t.count > 0 ? Math.round((t.totalUtil / t.count) * 10) / 10 : 0,
      totalHours: Math.round(t.totalHours * 10) / 10,
    }));

    res.json({ success: true, data: { rows, chartData, typeData, weeklyAvailableHours: Math.round(weeklyAvailableHours * 10) / 10 } });
  } catch (err) { next(err); }
};

// ─── GET /api/reports/scheduling-completion ───────────────────────────────────
const getSchedulingCompletion = async (req, res, next) => {
  try {
    const { department, semester, academicYear, section } = req.query;
    const ttFilter = buildTtFilter(req.query);
    const timetables = await Timetable.find(ttFilter)
      .populate("section", "name academicYear semester studentCount")
      .populate("department", "name code")
      .lean();
    const active = pickActiveTimetables(timetables);

    // Build subject filter
    const subFilter = { isActive: true };
    if (department && isOid(department)) subFilter.department = department;
    if (semester)                         subFilter.semester   = Number(semester);

    const allSubjects = await Subject.find(subFilter).populate("department", "name code").lean();
    const subjectMap  = new Map(allSubjects.map((s) => [String(s._id), s]));

    // Count scheduled periods per subject per timetable
    const rows = [];
    for (const tt of active) {
      const scheduledPerSubject = new Map();
      for (const entry of tt.entries) {
        const sid = String(entry.subject);
        scheduledPerSubject.set(sid, (scheduledPerSubject.get(sid) || 0) + 1);
      }

      // Subjects for this timetable's department + semester
      const ttSubjects = allSubjects.filter(
        (s) => String(s.department?._id || s.department) === String(tt.department?._id || tt.department)
          && s.semester === tt.semester
      );

      for (const sub of ttSubjects) {
        const sid = String(sub._id);
        const required = sub.subjectType === "Lab" ? Math.ceil(sub.weeklyHours / 2) : sub.weeklyHours;
        const scheduled = scheduledPerSubject.get(sid) || 0;
        const remaining = Math.max(0, required - scheduled);

        let status = "Fully Scheduled";
        if (scheduled === 0)        status = "Not Scheduled";
        else if (remaining > 0)     status = "Partially Scheduled";

        // Reason from stored unscheduledTasks
        let reason = "";
        if (status !== "Fully Scheduled") {
          const stored = (tt.unscheduledTasks || []).find((t) => String(t.subject) === sid);
          reason = stored?.reason || (status === "Not Scheduled" ? "No assignment found in timetable" : "Insufficient slots available");
        }

        rows.push({
          timetableId:  String(tt._id),
          department:   tt.department?.name || "—",
          semester:     tt.semester,
          section:      tt.section?.name || "—",
          academicYear: tt.academicYear,
          subjectId:    sid,
          subjectCode:  sub.code,
          subjectName:  sub.name,
          subjectType:  sub.subjectType,
          required,
          scheduled,
          remaining,
          status,
          reason,
        });
      }
    }

    // Summary
    const totalRequired  = rows.reduce((s, r) => s + r.required,  0);
    const totalScheduled = rows.reduce((s, r) => s + r.scheduled, 0);
    const fullyScheduled    = rows.filter((r) => r.status === "Fully Scheduled").length;
    const partiallyScheduled = rows.filter((r) => r.status === "Partially Scheduled").length;
    const notScheduled      = rows.filter((r) => r.status === "Not Scheduled").length;
    const completionPct = totalRequired > 0 ? Math.round((totalScheduled / totalRequired) * 100) : 0;

    // Chart: department-wise completion
    const deptMap = new Map();
    for (const r of rows) {
      if (!deptMap.has(r.department)) deptMap.set(r.department, { department: r.department, required: 0, scheduled: 0 });
      const dm = deptMap.get(r.department);
      dm.required  += r.required;
      dm.scheduled += r.scheduled;
    }
    const chartData = [...deptMap.values()].map((d) => ({
      ...d,
      completion: d.required > 0 ? Math.round((d.scheduled / d.required) * 100) : 0,
    }));

    res.json({
      success: true,
      data: {
        summary: { totalRequired, totalScheduled, totalUnscheduled: totalRequired - totalScheduled, completionPct, fullyScheduled, partiallyScheduled, notScheduled },
        rows,
        chartData,
      },
    });
  } catch (err) { next(err); }
};

// ─── GET /api/reports/conflicts ───────────────────────────────────────────────
const getConflicts = async (req, res, next) => {
  try {
    const { department, semester, section, timetableId } = req.query;
    const ttFilter = buildTtFilter(req.query);
    if (timetableId && isOid(timetableId)) ttFilter._id = timetableId;

    const timetables = await Timetable.find(ttFilter)
      .populate("section",    "name")
      .populate("department", "name code")
      .lean();
    const active = pickActiveTimetables(timetables);

    const [allSlots, allFaculty, allRooms, workingDayDocs] = await Promise.all([
      TimeSlot.find({ isActive: true }).lean(),
      Faculty.find({ isActive: true }).populate("subjects").lean(),
      Classroom.find({}).lean(),
      WorkingDay.find({ isWorkingDay: true }).lean(),
    ]);
    const enabledDays = workingDayDocs.map((d) => d.dayName);
    const facultyMap  = new Map(allFaculty.map((f) => [String(f._id), f]));
    const roomMap     = new Map(allRooms.map((r)   => [String(r._id), r]));

    const allConflicts = [];
    for (const tt of active) {
      const sectionDoc  = await Section.findById(tt.section?._id || tt.section).lean();
      const allSubjects = await Subject.find({ department: tt.department?._id || tt.department, semester: tt.semester, isActive: true }).lean();
      const result = validateTimetableFull({
        entries: tt.entries, allSlots, allFaculty, allRooms, allSubjects,
        enabledDays, studentCount: sectionDoc?.studentCount || 0,
      });
      const deduped = deduplicateConflicts(result.conflicts);
      for (const c of deduped) {
        // Enrich with timetable context
        const entryIdx = c.entryIndex ?? c.entryIndexA;
        const entry = entryIdx != null ? tt.entries[entryIdx] : null;
        allConflicts.push({
          ...c,
          timetableId:  String(tt._id),
          department:   tt.department?.name || "—",
          departmentId: String(tt.department?._id || tt.department || ""),
          section:      tt.section?.name || "—",
          sectionId:    String(tt.section?._id || tt.section || ""),
          semester:     tt.semester,
          academicYear: tt.academicYear,
          timetableStatus: tt.status,
          subject:      entry ? (entry.subject?.name || String(entry.subject)) : "—",
          faculty:      entry ? (facultyMap.get(String(entry.faculty))?.name || "—") : "—",
          classroom:    entry ? (roomMap.get(String(entry.classroom))?.roomNumber || "—") : "—",
        });
      }
    }

    // Category totals
    const categories = {};
    for (const c of allConflicts) {
      categories[c.type] = (categories[c.type] || 0) + 1;
    }

    const errors   = allConflicts.filter((c) => c.severity === "error");
    const warnings = allConflicts.filter((c) => c.severity === "warning");

    // Chart data
    const chartData = Object.entries(categories).map(([type, count]) => ({ type, count }));

    res.json({
      success: true,
      data: {
        summary: {
          total:    allConflicts.length,
          errors:   errors.length,
          warnings: warnings.length,
          categories,
        },
        conflicts: allConflicts,
        chartData,
      },
    });
  } catch (err) { next(err); }
};

// ─── GET /api/reports/department-summary ──────────────────────────────────────
const getDepartmentSummary = async (req, res, next) => {
  try {
    const ttFilter = buildTtFilter(req.query);
    const timetables = await Timetable.find(ttFilter).lean();
    const active = pickActiveTimetables(timetables);

    const departments = await Department.find({ isActive: true }).lean();
    const [allSubjects, allFaculty, allSections] = await Promise.all([
      Subject.find({ isActive: true }).lean(),
      Faculty.find({ isActive: true }).lean(),
      Section.find({ isActive: true }).lean(),
    ]);

    const rows = departments.map((dept) => {
      const did = String(dept._id);
      const deptTTs   = active.filter((tt) => String(tt.department) === did);
      const deptSubs  = allSubjects.filter((s) => String(s.department) === did);
      const deptFac   = allFaculty.filter((f)  => String(f.department) === did);
      const deptSecs  = allSections.filter((s) => String(s.department) === did);

      let totalRequired = 0, totalScheduled = 0;
      for (const tt of deptTTs) {
        totalRequired  += tt.statistics?.requiredTasks  || 0;
        totalScheduled += tt.statistics?.scheduledTasks || 0;
      }
      const completionPct = totalRequired > 0 ? Math.round((totalScheduled / totalRequired) * 100) : 0;

      return {
        _id:            did,
        name:           dept.name,
        code:           dept.code,
        subjectCount:   deptSubs.length,
        facultyCount:   deptFac.length,
        sectionCount:   deptSecs.length,
        timetableCount: deptTTs.length,
        totalRequired,
        totalScheduled,
        completionPct,
      };
    });

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

// ─── POST /api/reports/revalidate/:timetableId ────────────────────────────────
const revalidate = async (req, res, next) => {
  try {
    const { timetableId } = req.params;
    if (!isOid(timetableId)) return next(createError("Invalid timetable ID", 400));

    const tt = await Timetable.findById(timetableId).lean();
    if (!tt) return next(createError("Timetable not found", 404));

    const [allSlots, allFaculty, allRooms, workingDayDocs, allSubjects, sectionDoc] = await Promise.all([
      TimeSlot.find({ isActive: true }).lean(),
      Faculty.find({ isActive: true }).populate("subjects").lean(),
      Classroom.find({}).lean(),
      WorkingDay.find({ isWorkingDay: true }).lean(),
      Subject.find({ department: tt.department, semester: tt.semester, isActive: true }).lean(),
      Section.findById(tt.section).lean(),
    ]);

    const result = validateTimetableFull({
      entries: tt.entries, allSlots, allFaculty, allRooms, allSubjects,
      enabledDays: workingDayDocs.map((d) => d.dayName),
      studentCount: sectionDoc?.studentCount || 0,
    });
    const deduped = deduplicateConflicts(result.conflicts);

    res.json({
      success: true,
      valid:        deduped.filter((c) => c.severity === "error").length === 0,
      errorCount:   deduped.filter((c) => c.severity === "error").length,
      warningCount: deduped.filter((c) => c.severity === "warning").length,
      conflicts:    deduped,
      message: `Revalidation complete. ${deduped.filter((c) => c.severity === "error").length} error(s), ${deduped.filter((c) => c.severity === "warning").length} warning(s).`,
    });
  } catch (err) { next(err); }
};

module.exports = { getSummary, getFacultyWorkload, getClassroomUtilization, getSchedulingCompletion, getConflicts, getDepartmentSummary, revalidate };
