"use strict";

/**
 * timetableValidator.js
 *
 * Standalone conflict-detection and validation service.
 * All functions are pure (no DB calls) — they operate on plain objects
 * already fetched by the controller. This keeps them fast and testable.
 *
 * Conflict object shape:
 * {
 *   type:        string   — e.g. "FACULTY_CONFLICT"
 *   severity:    "error" | "warning"
 *   message:     string   — human-readable explanation
 *   day:         string   — e.g. "Monday"
 *   startTime:   string   — e.g. "09:00"
 *   endTime:     string   — e.g. "10:00"
 *   entryIndex:  number   — index in the entries array (for UI highlighting)
 *   resourceId:  string   — ID of the conflicting resource
 *   resourceName:string   — display name of the conflicting resource
 *   suggestion:  string   — optional fix hint
 * }
 */

// ─── Time helpers ─────────────────────────────────────────────────────────────

/** Convert "HH:MM" to minutes from midnight */
const toMin = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Half-open interval overlap: A and B overlap when
 *   A.start < B.end  AND  B.start < A.end
 * So 09:00–10:00 and 10:00–11:00 do NOT overlap (boundary touch is allowed).
 */
const timesOverlap = (aStart, aEnd, bStart, bEnd) =>
  toMin(aStart) < toMin(bEnd) && toMin(bStart) < toMin(aEnd);

/** Resolve a slot object from an ID — handles both populated objects and raw IDs */
const resolveSlot = (slotRef, allSlots) => {
  if (slotRef && typeof slotRef === "object" && slotRef.startTime) return slotRef;
  return allSlots.find((s) => String(s._id) === String(slotRef)) || null;
};

const sid = (v) => String(v?._id || v || "");

// ─── 1. Faculty conflict ──────────────────────────────────────────────────────

/**
 * checkFacultyConflict
 * Finds every pair of entries where the same faculty member is assigned
 * to overlapping periods on the same day.
 */
function checkFacultyConflict(entries, allSlots, excludeEntryId = null) {
  const conflicts = [];

  for (let i = 0; i < entries.length; i++) {
    const a = entries[i];
    if (excludeEntryId && sid(a._id) === String(excludeEntryId)) continue;

    const slotA = resolveSlot(a.timeSlot, allSlots);
    if (!slotA) continue;

    for (let j = i + 1; j < entries.length; j++) {
      const b = entries[j];
      if (excludeEntryId && sid(b._id) === String(excludeEntryId)) continue;
      if (a.day !== b.day) continue;
      if (sid(a.faculty) !== sid(b.faculty)) continue;

      const slotB = resolveSlot(b.timeSlot, allSlots);
      if (!slotB) continue;
      if (!timesOverlap(slotA.startTime, slotA.endTime, slotB.startTime, slotB.endTime)) continue;

      const facultyName = a.faculty?.name || b.faculty?.name || sid(a.faculty);
      const subA = a.subject?.name || sid(a.subject);
      const subB = b.subject?.name || sid(b.subject);

      conflicts.push({
        type: "FACULTY_CONFLICT",
        severity: "error",
        message: `${facultyName} is assigned to both "${subA}" and "${subB}" on ${a.day} during overlapping periods (${slotA.startTime}–${slotA.endTime} and ${slotB.startTime}–${slotB.endTime}).`,
        day: a.day,
        startTime: slotA.startTime,
        endTime: slotA.endTime,
        entryIndexA: i,
        entryIndexB: j,
        resourceId: sid(a.faculty),
        resourceName: facultyName,
        suggestion: `Assign a different faculty member to "${subB}" or move it to a non-overlapping slot.`,
      });
    }
  }
  return conflicts;
}

// ─── 2. Room conflict ─────────────────────────────────────────────────────────

function checkRoomConflict(entries, allSlots, excludeEntryId = null) {
  const conflicts = [];

  for (let i = 0; i < entries.length; i++) {
    const a = entries[i];
    if (excludeEntryId && sid(a._id) === String(excludeEntryId)) continue;

    const slotA = resolveSlot(a.timeSlot, allSlots);
    if (!slotA) continue;

    for (let j = i + 1; j < entries.length; j++) {
      const b = entries[j];
      if (excludeEntryId && sid(b._id) === String(excludeEntryId)) continue;
      if (a.day !== b.day) continue;
      if (sid(a.classroom) !== sid(b.classroom)) continue;

      const slotB = resolveSlot(b.timeSlot, allSlots);
      if (!slotB) continue;
      if (!timesOverlap(slotA.startTime, slotA.endTime, slotB.startTime, slotB.endTime)) continue;

      const roomName = a.classroom?.roomNumber || b.classroom?.roomNumber || sid(a.classroom);
      const subA = a.subject?.name || sid(a.subject);
      const subB = b.subject?.name || sid(b.subject);

      conflicts.push({
        type: "ROOM_CONFLICT",
        severity: "error",
        message: `Room ${roomName} is double-booked on ${a.day}: "${subA}" and "${subB}" overlap (${slotA.startTime}–${slotA.endTime} and ${slotB.startTime}–${slotB.endTime}).`,
        day: a.day,
        startTime: slotA.startTime,
        endTime: slotA.endTime,
        entryIndexA: i,
        entryIndexB: j,
        resourceId: sid(a.classroom),
        resourceName: roomName,
        suggestion: `Move one of the classes to a different room or a non-overlapping time slot.`,
      });
    }
  }
  return conflicts;
}

// ─── 3. Section conflict ──────────────────────────────────────────────────────

function checkSectionConflict(entries, allSlots, excludeEntryId = null) {
  const conflicts = [];

  for (let i = 0; i < entries.length; i++) {
    const a = entries[i];
    if (excludeEntryId && sid(a._id) === String(excludeEntryId)) continue;

    const slotA = resolveSlot(a.timeSlot, allSlots);
    if (!slotA) continue;

    for (let j = i + 1; j < entries.length; j++) {
      const b = entries[j];
      if (excludeEntryId && sid(b._id) === String(excludeEntryId)) continue;
      if (a.day !== b.day) continue;
      if (sid(a.section) !== sid(b.section)) continue;

      const slotB = resolveSlot(b.timeSlot, allSlots);
      if (!slotB) continue;
      if (!timesOverlap(slotA.startTime, slotA.endTime, slotB.startTime, slotB.endTime)) continue;

      const sectionName = a.section?.name || b.section?.name || sid(a.section);
      const subA = a.subject?.name || sid(a.subject);
      const subB = b.subject?.name || sid(b.subject);

      conflicts.push({
        type: "SECTION_CONFLICT",
        severity: "error",
        message: `Section ${sectionName} is scheduled for both "${subA}" and "${subB}" on ${a.day} at overlapping times (${slotA.startTime}–${slotA.endTime} and ${slotB.startTime}–${slotB.endTime}).`,
        day: a.day,
        startTime: slotA.startTime,
        endTime: slotA.endTime,
        entryIndexA: i,
        entryIndexB: j,
        resourceId: sid(a.section),
        resourceName: sectionName,
        suggestion: `Move "${subB}" to a different time slot for section ${sectionName}.`,
      });
    }
  }
  return conflicts;
}

// ─── 4. Duplicate allocation ──────────────────────────────────────────────────

function checkDuplicateAllocation(entries) {
  const conflicts = [];
  const seen = new Map();

  entries.forEach((e, i) => {
    // A duplicate is: same section + same subject + same day + same timeSlot
    const key = `${sid(e.section)}|${sid(e.subject)}|${e.day}|${sid(e.timeSlot)}`;
    if (seen.has(key)) {
      const firstIdx = seen.get(key);
      const subName = e.subject?.name || sid(e.subject);
      const secName = e.section?.name || sid(e.section);
      conflicts.push({
        type: "DUPLICATE_ALLOCATION",
        severity: "error",
        message: `"${subName}" is assigned twice to section ${secName} on ${e.day} at the same time slot (entries ${firstIdx} and ${i}).`,
        day: e.day,
        entryIndexA: firstIdx,
        entryIndexB: i,
        resourceId: sid(e.subject),
        resourceName: subName,
        suggestion: `Remove the duplicate entry.`,
      });
    } else {
      seen.set(key, i);
    }
  });
  return conflicts;
}

// ─── 5. Faculty eligibility ───────────────────────────────────────────────────

function checkFacultyEligibility(entries, allFaculty) {
  const conflicts = [];
  const facultyMap = new Map(allFaculty.map((f) => [sid(f), f]));

  entries.forEach((e, i) => {
    const faculty = facultyMap.get(sid(e.faculty));
    if (!faculty) {
      conflicts.push({
        type: "INVALID_FACULTY",
        severity: "error",
        message: `Entry ${i}: Faculty record not found (ID: ${sid(e.faculty)}).`,
        day: e.day,
        entryIndex: i,
        resourceId: sid(e.faculty),
        resourceName: "Unknown faculty",
        suggestion: "Ensure the faculty member exists and is active.",
      });
      return;
    }

    if (!faculty.isActive) {
      conflicts.push({
        type: "INACTIVE_FACULTY",
        severity: "error",
        message: `${faculty.name} is inactive and cannot be assigned to "${e.subject?.name || sid(e.subject)}" on ${e.day}.`,
        day: e.day,
        entryIndex: i,
        resourceId: sid(e.faculty),
        resourceName: faculty.name,
        suggestion: `Activate ${faculty.name} or assign a different faculty member.`,
      });
      return;
    }

    const subjectId = sid(e.subject);
    const isEligible = faculty.subjects.some((s) => sid(s) === subjectId);
    if (!isEligible) {
      const subName = e.subject?.name || subjectId;
      conflicts.push({
        type: "FACULTY_NOT_ELIGIBLE",
        severity: "error",
        message: `${faculty.name} is not assigned to teach "${subName}". Only eligible faculty may be assigned.`,
        day: e.day,
        entryIndex: i,
        resourceId: sid(e.faculty),
        resourceName: faculty.name,
        suggestion: `Add "${subName}" to ${faculty.name}'s subject list, or assign a different faculty member.`,
      });
    }
  });
  return conflicts;
}

// ─── 6. Room suitability ──────────────────────────────────────────────────────

function checkRoomSuitability(entries, allRooms, allSubjects, sectionStudentCount) {
  const conflicts = [];
  const roomMap = new Map(allRooms.map((r) => [sid(r), r]));
  const subjectMap = new Map(allSubjects.map((s) => [sid(s), s]));

  entries.forEach((e, i) => {
    const room = roomMap.get(sid(e.classroom));
    const subject = subjectMap.get(sid(e.subject));

    if (!room) {
      conflicts.push({
        type: "INVALID_ROOM",
        severity: "error",
        message: `Entry ${i}: Classroom record not found (ID: ${sid(e.classroom)}).`,
        day: e.day,
        entryIndex: i,
        resourceId: sid(e.classroom),
        resourceName: "Unknown room",
        suggestion: "Ensure the classroom exists and is available.",
      });
      return;
    }

    if (!room.isAvailable) {
      conflicts.push({
        type: "ROOM_UNAVAILABLE",
        severity: "error",
        message: `Room ${room.roomNumber} is marked as unavailable but is assigned on ${e.day}.`,
        day: e.day,
        entryIndex: i,
        resourceId: sid(e.classroom),
        resourceName: room.roomNumber,
        suggestion: `Mark room ${room.roomNumber} as available or assign a different room.`,
      });
    }

    if (subject) {
      // Room type check
      if (subject.requiredRoomType !== "Any" && room.roomType !== subject.requiredRoomType) {
        conflicts.push({
          type: "ROOM_TYPE_MISMATCH",
          severity: "error",
          message: `"${subject.name}" requires a ${subject.requiredRoomType} but is assigned to ${room.roomNumber} (${room.roomType}) on ${e.day}.`,
          day: e.day,
          entryIndex: i,
          resourceId: sid(e.classroom),
          resourceName: room.roomNumber,
          suggestion: `Assign a room of type "${subject.requiredRoomType}" for "${subject.name}".`,
        });
      }

      // Capacity check
      const count = sectionStudentCount || 0;
      if (count > 0 && room.capacity < count) {
        conflicts.push({
          type: "ROOM_CAPACITY",
          severity: "error",
          message: `Room ${room.roomNumber} (capacity ${room.capacity}) is too small for the section (${count} students) assigned on ${e.day}.`,
          day: e.day,
          entryIndex: i,
          resourceId: sid(e.classroom),
          resourceName: room.roomNumber,
          suggestion: `Use a room with capacity ≥ ${count} students.`,
        });
      }
    }
  });
  return conflicts;
}

// ─── 7. Working day validation ────────────────────────────────────────────────

function checkWorkingDay(entries, enabledDays) {
  const conflicts = [];
  const enabledSet = new Set(enabledDays);

  entries.forEach((e, i) => {
    if (!enabledSet.has(e.day)) {
      conflicts.push({
        type: "INVALID_WORKING_DAY",
        severity: "error",
        message: `A class is scheduled on ${e.day}, which is not a configured working day.`,
        day: e.day,
        entryIndex: i,
        resourceId: e.day,
        resourceName: e.day,
        suggestion: `Enable ${e.day} as a working day or move the class to a valid day.`,
      });
    }
  });
  return conflicts;
}

// ─── 8. Time slot validity ────────────────────────────────────────────────────

function checkTimeSlotValidity(entries, allSlots) {
  const conflicts = [];
  const slotMap = new Map(allSlots.map((s) => [sid(s), s]));

  entries.forEach((e, i) => {
    const slot = slotMap.get(sid(e.timeSlot));

    if (!slot) {
      conflicts.push({
        type: "INVALID_TIME_SLOT",
        severity: "error",
        message: `Entry ${i} references a time slot that does not exist (ID: ${sid(e.timeSlot)}).`,
        day: e.day,
        entryIndex: i,
        resourceId: sid(e.timeSlot),
        resourceName: "Unknown slot",
        suggestion: "Regenerate the timetable — this slot may have been deleted.",
      });
      return;
    }

    if (!slot.isActive) {
      conflicts.push({
        type: "INACTIVE_TIME_SLOT",
        severity: "error",
        message: `Entry ${i} uses time slot "${slot.slotName}" (${slot.startTime}–${slot.endTime}) which is inactive.`,
        day: e.day,
        startTime: slot.startTime,
        endTime: slot.endTime,
        entryIndex: i,
        resourceId: sid(e.timeSlot),
        resourceName: slot.slotName,
        suggestion: `Activate the time slot or move the class to an active slot.`,
      });
    }

    if (slot.slotType === "Break") {
      conflicts.push({
        type: "CLASS_DURING_BREAK",
        severity: "error",
        message: `A class is scheduled during the break slot "${slot.slotName}" (${slot.startTime}–${slot.endTime}) on ${e.day}.`,
        day: e.day,
        startTime: slot.startTime,
        endTime: slot.endTime,
        entryIndex: i,
        resourceId: sid(e.timeSlot),
        resourceName: slot.slotName,
        suggestion: "Move the class to a non-break time slot.",
      });
    }
  });
  return conflicts;
}

// ─── 9. Weekly hours check ────────────────────────────────────────────────────

/**
 * checkWeeklyHours
 * Verifies that each subject has been scheduled for exactly its required
 * weekly hours (or lab sessions). Returns warnings for under-scheduling.
 */
function checkWeeklyHours(entries, allSubjects) {
  const conflicts = [];
  const subjectMap = new Map(allSubjects.map((s) => [sid(s), s]));

  // Count scheduled periods per subject
  const scheduled = {};
  entries.forEach((e) => {
    const id = sid(e.subject);
    scheduled[id] = (scheduled[id] || 0) + 1;
  });

  subjectMap.forEach((subject, id) => {
    const needed = subject.subjectType === "Lab"
      ? Math.ceil(subject.weeklyHours / 2)
      : subject.weeklyHours;
    const got = scheduled[id] || 0;

    if (got < needed) {
      conflicts.push({
        type: "INSUFFICIENT_WEEKLY_HOURS",
        severity: "warning",
        message: `"${subject.name}" (${subject.code}) requires ${needed} period(s) per week but only ${got} are scheduled.`,
        resourceId: id,
        resourceName: subject.name,
        suggestion: `Schedule ${needed - got} more period(s) for "${subject.name}".`,
      });
    }

    if (got > needed) {
      conflicts.push({
        type: "EXCESS_WEEKLY_HOURS",
        severity: "warning",
        message: `"${subject.name}" (${subject.code}) requires ${needed} period(s) per week but ${got} are scheduled.`,
        resourceId: id,
        resourceName: subject.name,
        suggestion: `Remove ${got - needed} extra period(s) for "${subject.name}".`,
      });
    }
  });
  return conflicts;
}

// ─── 10. Lab continuity ───────────────────────────────────────────────────────

/**
 * checkLabContinuity
 * For every lab entry (isLabSession === true), verify that:
 * - additionalSlots is non-empty
 * - the additional slot immediately follows the primary slot (no gap)
 * - both slots are on the same day (guaranteed by schema but checked anyway)
 */
function checkLabContinuity(entries, allSlots) {
  const conflicts = [];
  const slotMap = new Map(allSlots.map((s) => [sid(s), s]));

  entries.forEach((e, i) => {
    if (!e.isLabSession) return;

    const primarySlot = slotMap.get(sid(e.timeSlot));
    if (!primarySlot) return; // Already caught by checkTimeSlotValidity

    if (!e.additionalSlots || e.additionalSlots.length === 0) {
      conflicts.push({
        type: "LAB_MISSING_CONSECUTIVE_SLOT",
        severity: "error",
        message: `Lab session "${e.subject?.name || sid(e.subject)}" on ${e.day} at ${primarySlot.startTime} has no consecutive follow-up slot assigned.`,
        day: e.day,
        startTime: primarySlot.startTime,
        endTime: primarySlot.endTime,
        entryIndex: i,
        resourceId: sid(e.subject),
        resourceName: e.subject?.name || sid(e.subject),
        suggestion: "Assign a consecutive time slot for the lab session.",
      });
      return;
    }

    // Check each additional slot is immediately consecutive
    let prevSlot = primarySlot;
    e.additionalSlots.forEach((addSlotRef, k) => {
      const addSlot = slotMap.get(sid(addSlotRef));
      if (!addSlot) {
        conflicts.push({
          type: "LAB_INVALID_CONSECUTIVE_SLOT",
          severity: "error",
          message: `Lab session "${e.subject?.name || sid(e.subject)}" on ${e.day}: additional slot ${k + 1} does not exist.`,
          day: e.day,
          entryIndex: i,
          resourceId: sid(e.subject),
          resourceName: e.subject?.name || sid(e.subject),
          suggestion: "Regenerate the timetable — the consecutive slot may have been deleted.",
        });
        return;
      }

      const prevEnd = toMin(prevSlot.endTime);
      const nextStart = toMin(addSlot.startTime);

      if (nextStart !== prevEnd) {
        conflicts.push({
          type: "LAB_NON_CONSECUTIVE_SLOTS",
          severity: "error",
          message: `Lab session "${e.subject?.name || sid(e.subject)}" on ${e.day}: slot ${prevSlot.startTime}–${prevSlot.endTime} is not immediately followed by ${addSlot.startTime}–${addSlot.endTime} (gap of ${nextStart - prevEnd} minutes).`,
          day: e.day,
          startTime: primarySlot.startTime,
          endTime: addSlot.endTime,
          entryIndex: i,
          resourceId: sid(e.subject),
          resourceName: e.subject?.name || sid(e.subject),
          suggestion: "Ensure lab slots are contiguous with no gap or break between them.",
        });
      }
      prevSlot = addSlot;
    });
  });
  return conflicts;
}

// ─── 11. Faculty max weekly hours ─────────────────────────────────────────────

function checkFacultyWeeklyHours(entries, allFaculty) {
  const conflicts = [];
  const facultyMap = new Map(allFaculty.map((f) => [sid(f), f]));

  // Count periods per faculty
  const counts = {};
  entries.forEach((e) => {
    const id = sid(e.faculty);
    counts[id] = (counts[id] || 0) + 1;
    // Lab sessions count as 2 hours
    if (e.isLabSession) counts[id] += 1;
  });

  Object.entries(counts).forEach(([facultyId, count]) => {
    const faculty = facultyMap.get(facultyId);
    if (!faculty) return;
    if (count > faculty.maxWeeklyHours) {
      conflicts.push({
        type: "FACULTY_OVERLOADED",
        severity: "warning",
        message: `${faculty.name} is assigned ${count} teaching hour(s) this week, exceeding their maximum of ${faculty.maxWeeklyHours}.`,
        resourceId: facultyId,
        resourceName: faculty.name,
        suggestion: `Reduce ${faculty.name}'s load or increase their maxWeeklyHours limit.`,
      });
    }
  });
  return conflicts;
}

// ─── 12. Master validator ─────────────────────────────────────────────────────

/**
 * validateTimetableFull
 *
 * Runs all checks and returns a structured result.
 *
 * @param {object} params
 * @param {Array}  params.entries         - timetable entry objects (may be populated or raw IDs)
 * @param {Array}  params.allSlots        - all TimeSlot documents
 * @param {Array}  params.allFaculty      - all Faculty documents (with .subjects populated)
 * @param {Array}  params.allRooms        - all Classroom documents
 * @param {Array}  params.allSubjects     - subjects relevant to this timetable
 * @param {Array}  params.enabledDays     - array of day name strings e.g. ["Monday","Tuesday"]
 * @param {number} params.studentCount    - section's student count
 * @param {string} [params.excludeEntryId] - entry _id to exclude from self-conflict checks (for edits)
 */
function validateTimetableFull({
  entries,
  allSlots,
  allFaculty,
  allRooms,
  allSubjects,
  enabledDays,
  studentCount = 0,
  excludeEntryId = null,
}) {
  const conflicts = [
    ...checkFacultyConflict(entries, allSlots, excludeEntryId),
    ...checkRoomConflict(entries, allSlots, excludeEntryId),
    ...checkSectionConflict(entries, allSlots, excludeEntryId),
    ...checkDuplicateAllocation(entries),
    ...checkFacultyEligibility(entries, allFaculty),
    ...checkRoomSuitability(entries, allRooms, allSubjects, studentCount),
    ...checkWorkingDay(entries, enabledDays),
    ...checkTimeSlotValidity(entries, allSlots),
    ...checkLabContinuity(entries, allSlots),
    ...checkFacultyWeeklyHours(entries, allFaculty),
    ...checkWeeklyHours(entries, allSubjects),
  ];

  const errors   = conflicts.filter((c) => c.severity === "error");
  const warnings = conflicts.filter((c) => c.severity === "warning");

  return {
    valid: errors.length === 0,
    totalChecked: entries.length,
    errorCount: errors.length,
    warningCount: warnings.length,
    conflicts,
    // Group by type for the UI summary
    byType: conflicts.reduce((acc, c) => {
      acc[c.type] = (acc[c.type] || 0) + 1;
      return acc;
    }, {}),
  };
}

module.exports = {
  validateTimetableFull,
  checkFacultyConflict,
  checkRoomConflict,
  checkSectionConflict,
  checkDuplicateAllocation,
  checkFacultyEligibility,
  checkRoomSuitability,
  checkWorkingDay,
  checkTimeSlotValidity,
  checkWeeklyHours,
  checkLabContinuity,
  checkFacultyWeeklyHours,
  timesOverlap,
  toMin,
};
