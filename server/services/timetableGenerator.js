"use strict";

/**
 * Smart Timetable Generator — Scheduling Algorithm
 *
 * Approach: Constraint-based greedy assignment with backtracking recovery.
 * 1. Build a list of "tasks" — one task per required weekly period per subject.
 * 2. Sort tasks by most-constrained first (fewest valid slots available).
 * 3. For each task, try every valid (day, slot, faculty, room) combination.
 * 4. Skip any combination that violates a hard constraint.
 * 5. If stuck, backtrack up to MAX_BACKTRACK attempts.
 * 6. Report unscheduled tasks with reasons.
 */

const MAX_BACKTRACK = 200;
const MAX_ITERATIONS = 5000;

// ─── Helpers ────────────────────────────────────────────────────────────────

const toMin = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const slotsOverlap = (a, b) =>
  toMin(a.startTime) < toMin(b.endTime) && toMin(a.endTime) > toMin(b.startTime);

// Check if a room type satisfies a subject's required room type
const roomSuitable = (room, subject) => {
  if (subject.requiredRoomType === "Any") return true;
  return room.roomType === subject.requiredRoomType;
};

// ─── Hard Constraint Checkers ────────────────────────────────────────────────

function isFacultyFree(assignments, facultyId, day, slot, allSlots) {
  return !assignments.some(
    (a) =>
      String(a.faculty) === String(facultyId) &&
      a.day === day &&
      slotsOverlap(slot, allSlots.find((s) => String(s._id) === String(a.timeSlot)))
  );
}

function isRoomFree(assignments, roomId, day, slot, allSlots) {
  return !assignments.some(
    (a) =>
      String(a.classroom) === String(roomId) &&
      a.day === day &&
      slotsOverlap(slot, allSlots.find((s) => String(s._id) === String(a.timeSlot)))
  );
}

function isSectionFree(assignments, sectionId, day, slot, allSlots) {
  return !assignments.some(
    (a) =>
      String(a.section) === String(sectionId) &&
      a.day === day &&
      slotsOverlap(slot, allSlots.find((s) => String(s._id) === String(a.timeSlot)))
  );
}

function isFacultyAvailable(faculty, day) {
  // faculty.availability is a Map: { "Monday": ["09:00-10:00"], ... } of UNAVAILABLE slots
  // If the map has no entry for this day, faculty is fully available
  if (!faculty.availability || !faculty.availability.size) return true;
  const unavailable = faculty.availability.get(day);
  // If no unavailability listed for this day, they're available
  return !unavailable || unavailable.length === 0;
}

// ─── Build Tasks ─────────────────────────────────────────────────────────────

/**
 * Expand subjects into individual scheduling tasks.
 * A subject needing 4 weekly hours → 4 tasks (one per period).
 * A Lab subject needing 2 hours → 1 task marked as lab (needs 2 consecutive slots).
 */
function buildTasks(subjects) {
  const tasks = [];
  for (const subject of subjects) {
    const isLab = subject.subjectType === "Lab";
    if (isLab) {
      // Lab: one task that needs 2 consecutive slots
      const periodsNeeded = Math.ceil(subject.weeklyHours / 2);
      for (let i = 0; i < periodsNeeded; i++) {
        tasks.push({ subject, isLab: true, taskIndex: i });
      }
    } else {
      for (let i = 0; i < subject.weeklyHours; i++) {
        tasks.push({ subject, isLab: false, taskIndex: i });
      }
    }
  }
  return tasks;
}

// ─── Find Eligible Faculty & Rooms ───────────────────────────────────────────

function getEligibleFaculty(subject, allFaculty) {
  return allFaculty.filter(
    (f) =>
      f.isActive &&
      f.subjects.some((s) => String(s._id || s) === String(subject._id))
  );
}

function getEligibleRooms(subject, allRooms, studentCount) {
  return allRooms.filter(
    (r) =>
      r.isAvailable &&
      roomSuitable(r, subject) &&
      r.capacity >= studentCount
  );
}

// ─── Find Consecutive Slots (for Labs) ───────────────────────────────────────

function findConsecutiveSlots(slot, allTeachingSlots) {
  const slotEnd = toMin(slot.endTime);
  const next = allTeachingSlots.find((s) => toMin(s.startTime) === slotEnd);
  return next || null;
}

// ─── Score a candidate assignment (soft constraints) ─────────────────────────

function scoreAssignment(assignments, faculty, day, slot, sectionId, subjectId) {
  let score = 0;

  // Prefer spreading subject sessions across different days
  const subjectDays = assignments
    .filter((a) => String(a.subject) === String(subjectId))
    .map((a) => a.day);
  if (!subjectDays.includes(day)) score += 10;

  // Penalise too many consecutive classes for faculty on same day
  const facultyDayCount = assignments.filter(
    (a) => String(a.faculty) === String(faculty._id) && a.day === day
  ).length;
  if (facultyDayCount >= 3) score -= 5;

  // Prefer earlier slots (students prefer morning classes)
  score -= toMin(slot.startTime) / 60;

  return score;
}

// ─── Main Generator ──────────────────────────────────────────────────────────

async function generateTimetable({ section, subjects, faculty, classrooms, workingDays, timeSlots }) {
  const startTime = Date.now();

  const teachingSlots = timeSlots.filter((s) => s.isActive && s.slotType !== "Break");
  const studentCount = section.studentCount || 0;

  // Build all tasks
  let tasks = buildTasks(subjects);

  // Pre-compute eligible faculty and rooms per subject
  const eligibilityMap = {};
  const unscheduledReasons = [];

  for (const subject of subjects) {
    const eligFaculty = getEligibleFaculty(subject, faculty);
    const eligRooms = getEligibleRooms(subject, classrooms, studentCount);

    eligibilityMap[String(subject._id)] = { faculty: eligFaculty, rooms: eligRooms };

    if (eligFaculty.length === 0) {
      unscheduledReasons.push({
        subject: subject._id,
        subjectName: subject.name,
        subjectCode: subject.code,
        reason: `No eligible faculty assigned to teach "${subject.name}". Assign at least one faculty member to this subject.`,
        periodsNeeded: subject.weeklyHours,
        periodsScheduled: 0,
      });
    }
    if (eligRooms.length === 0) {
      unscheduledReasons.push({
        subject: subject._id,
        subjectName: subject.name,
        subjectCode: subject.code,
        reason: `No suitable available room found for "${subject.name}" (requires ${subject.requiredRoomType}, capacity ≥ ${studentCount}).`,
        periodsNeeded: subject.weeklyHours,
        periodsScheduled: 0,
      });
    }
  }

  // Remove tasks for subjects that have no faculty or no rooms (can't schedule them)
  const blockedSubjectIds = new Set(unscheduledReasons.map((u) => String(u.subject)));
  tasks = tasks.filter((t) => !blockedSubjectIds.has(String(t.subject._id)));

  // Sort tasks: most constrained first
  tasks.sort((a, b) => {
    const aElig = eligibilityMap[String(a.subject._id)];
    const bElig = eligibilityMap[String(b.subject._id)];
    const aOptions = (aElig?.faculty.length || 0) * (aElig?.rooms.length || 0);
    const bOptions = (bElig?.faculty.length || 0) * (bElig?.rooms.length || 0);
    if (a.isLab !== b.isLab) return a.isLab ? -1 : 1; // Labs first
    return aOptions - bOptions;
  });

  const assignments = [];
  let iterations = 0;
  let backtracks = 0;

  // Track how many periods scheduled per subject
  const scheduledCount = {};

  // ── Greedy assignment with backtracking ──
  const assign = (taskIndex) => {
    if (taskIndex >= tasks.length) return true; // All tasks assigned
    if (iterations++ > MAX_ITERATIONS) return false;

    const task = tasks[taskIndex];
    const subjectId = String(task.subject._id);
    const { faculty: eligFaculty, rooms: eligRooms } = eligibilityMap[subjectId];

    // Build candidate list: all (day, slot, faculty, room) combos
    const candidates = [];

    for (const day of workingDays) {
      for (const slot of teachingSlots) {
        // For lab: need this slot AND the next consecutive slot
        let extraSlot = null;
        if (task.isLab) {
          extraSlot = findConsecutiveSlots(slot, teachingSlots);
          if (!extraSlot) continue; // No consecutive slot available
        }

        for (const fac of eligFaculty) {
          if (!isFacultyAvailable(fac, day)) continue;
          if (!isFacultyFree(assignments, fac._id, day, slot, timeSlots)) continue;
          if (task.isLab && !isFacultyFree(assignments, fac._id, day, extraSlot, timeSlots)) continue;

          if (!isSectionFree(assignments, section._id, day, slot, timeSlots)) continue;
          if (task.isLab && !isSectionFree(assignments, section._id, day, extraSlot, timeSlots)) continue;

          for (const room of eligRooms) {
            if (!isRoomFree(assignments, room._id, day, slot, timeSlots)) continue;
            if (task.isLab && !isRoomFree(assignments, room._id, day, extraSlot, timeSlots)) continue;

            const score = scoreAssignment(assignments, fac, day, slot, section._id, task.subject._id);
            candidates.push({ day, slot, extraSlot, faculty: fac, room, score });
          }
        }
      }
    }

    if (candidates.length === 0) {
      // Backtrack
      if (backtracks++ < MAX_BACKTRACK && assignments.length > 0) {
        const removed = assignments.pop();
        const removedSubId = String(removed.subject);
        if (scheduledCount[removedSubId]) scheduledCount[removedSubId]--;
        return false;
      }
      return false;
    }

    // Sort candidates by score descending
    candidates.sort((a, b) => b.score - a.score);

    for (const candidate of candidates) {
      const entry = {
        subject: task.subject._id,
        faculty: candidate.faculty._id,
        classroom: candidate.room._id,
        section: section._id,
        day: candidate.day,
        timeSlot: candidate.slot._id,
        isLabSession: task.isLab,
        additionalSlots: candidate.extraSlot ? [candidate.extraSlot._id] : [],
      };

      assignments.push(entry);
      scheduledCount[subjectId] = (scheduledCount[subjectId] || 0) + 1;

      if (assign(taskIndex + 1)) return true;

      // Undo and try next candidate
      assignments.pop();
      scheduledCount[subjectId] = Math.max(0, (scheduledCount[subjectId] || 1) - 1);
    }

    return false;
  };

  assign(0);

  // ── Build unscheduled report ──
  const requiredCounts = {};
  for (const task of [...tasks, ...buildTasks(subjects.filter((s) => blockedSubjectIds.has(String(s._id))))]) {
    const id = String(task.subject._id);
    requiredCounts[id] = (requiredCounts[id] || 0) + 1;
  }

  // Find subjects that didn't get all their periods
  for (const subject of subjects) {
    const id = String(subject._id);
    if (blockedSubjectIds.has(id)) continue;
    const needed = subject.subjectType === "Lab" ? Math.ceil(subject.weeklyHours / 2) : subject.weeklyHours;
    const got = scheduledCount[id] || 0;
    if (got < needed) {
      unscheduledReasons.push({
        subject: subject._id,
        subjectName: subject.name,
        subjectCode: subject.code,
        reason: `"${subject.name}" needed ${needed} period(s) but only ${got} could be scheduled. Check faculty availability and time slot capacity.`,
        periodsNeeded: needed,
        periodsScheduled: got,
      });
    }
  }

  // ── Quality Score ──
  // Score out of 100: penalise gaps, reward spread
  let qualityScore = 100;
  const totalNeeded = subjects.reduce((sum, s) =>
    sum + (s.subjectType === "Lab" ? Math.ceil(s.weeklyHours / 2) : s.weeklyHours), 0);
  const totalScheduled = assignments.length;
  if (totalNeeded > 0) {
    qualityScore = Math.round((totalScheduled / totalNeeded) * 100);
  }

  const generationTimeMs = Date.now() - startTime;

  return {
    entries: assignments,
    unscheduledTasks: unscheduledReasons,
    statistics: {
      requiredTasks: totalNeeded,
      scheduledTasks: totalScheduled,
      unscheduledTasks: unscheduledReasons.length,
      totalConflictsDetected: backtracks,
      qualityScore,
      generationTimeMs,
    },
  };
}

// ─── Hard Constraint Validator (post-generation) ─────────────────────────────

function validateTimetable(entries, timeSlots) {
  const violations = [];

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];
      if (a.day !== b.day) continue;

      const slotA = timeSlots.find((s) => String(s._id) === String(a.timeSlot));
      const slotB = timeSlots.find((s) => String(s._id) === String(b.timeSlot));
      if (!slotA || !slotB) continue;
      if (!slotsOverlap(slotA, slotB)) continue;

      if (String(a.faculty) === String(b.faculty)) {
        violations.push(`Faculty conflict on ${a.day}: same faculty assigned to two overlapping slots.`);
      }
      if (String(a.classroom) === String(b.classroom)) {
        violations.push(`Room conflict on ${a.day}: same classroom assigned to two overlapping slots.`);
      }
      if (String(a.section) === String(b.section)) {
        violations.push(`Section conflict on ${a.day}: same section has two overlapping classes.`);
      }
    }
  }

  return violations;
}

module.exports = { generateTimetable, validateTimetable };
