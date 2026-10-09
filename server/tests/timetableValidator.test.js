"use strict";

const {
  validateTimetableFull,
  checkFacultyConflict,
  checkRoomConflict,
  checkSectionConflict,
  checkDuplicateAllocation,
  checkFacultyEligibility,
  checkRoomSuitability,
  checkWorkingDay,
  checkTimeSlotValidity,
  checkLabContinuity,
  timesOverlap,
} = require("../services/timetableValidator");

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeId = (n) => `000000000000000000000${n}`.slice(-24);

const slot = (id, start, end, type = "Regular Class") => ({
  _id: makeId(id), slotName: `P${id}`, startTime: start, endTime: end,
  slotType: type, isActive: true,
});

const entry = (overrides) => ({
  _id: makeId(overrides.id || 99),
  subject:   { _id: makeId(overrides.subId   || 20), name: overrides.subName  || "Maths",   code: "MA301", subjectType: overrides.subType || "Theory", weeklyHours: 2, requiredRoomType: overrides.roomType || "Classroom" },
  faculty:   { _id: makeId(overrides.facId   || 30), name: overrides.facName  || "Dr. A",   isActive: overrides.facActive !== false, subjects: [{ _id: makeId(overrides.subId || 20) }], maxWeeklyHours: 20 },
  classroom: { _id: makeId(overrides.roomId  || 40), roomNumber: overrides.roomNo || "A101", roomType: overrides.roomKind || "Classroom", capacity: overrides.cap || 60, isAvailable: overrides.roomAvail !== false },
  section:   { _id: makeId(overrides.secId   || 10), name: overrides.secName  || "CSE-A",   studentCount: overrides.students || 30 },
  day:       overrides.day       || "Monday",
  timeSlot:  { _id: makeId(overrides.slotId  || 50), startTime: overrides.start || "09:00", endTime: overrides.end || "10:00", slotType: "Regular Class", isActive: true },
  isLabSession:    overrides.isLab    || false,
  additionalSlots: overrides.addSlots || [],
});

const allSlots = [
  slot(50, "09:00", "10:00"),
  slot(51, "10:00", "11:00"),
  slot(52, "11:00", "12:00"),
  slot(53, "12:00", "13:00", "Break"),
  slot(54, "13:00", "14:00"),
  slot(55, "14:00", "15:00"),
];

const enabledDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

// ── 1. timesOverlap helper ────────────────────────────────────────────────────

describe("timesOverlap", () => {
  test("identical slots overlap", () => {
    expect(timesOverlap("09:00", "10:00", "09:00", "10:00")).toBe(true);
  });
  test("partial overlap detected", () => {
    expect(timesOverlap("09:00", "10:00", "09:30", "10:30")).toBe(true);
  });
  test("one inside another overlaps", () => {
    expect(timesOverlap("09:00", "11:00", "09:30", "10:00")).toBe(true);
  });
  test("boundary touch does NOT overlap (half-open)", () => {
    expect(timesOverlap("09:00", "10:00", "10:00", "11:00")).toBe(false);
  });
  test("completely separate slots do not overlap", () => {
    expect(timesOverlap("09:00", "10:00", "11:00", "12:00")).toBe(false);
  });
});

// ── 2. Faculty conflict ───────────────────────────────────────────────────────

describe("checkFacultyConflict", () => {
  test("same faculty overlapping slots → conflict", () => {
    const entries = [
      entry({ id: 1, facId: 30, slotId: 50, start: "09:00", end: "10:00" }),
      entry({ id: 2, facId: 30, slotId: 50, start: "09:00", end: "10:00", subId: 21 }),
    ];
    const c = checkFacultyConflict(entries, allSlots);
    expect(c.some((x) => x.type === "FACULTY_CONFLICT")).toBe(true);
  });

  test("different faculty same slot → no conflict", () => {
    const entries = [
      entry({ id: 1, facId: 30, slotId: 50 }),
      entry({ id: 2, facId: 31, slotId: 50, subId: 21 }),
    ];
    const c = checkFacultyConflict(entries, allSlots);
    expect(c.filter((x) => x.type === "FACULTY_CONFLICT")).toHaveLength(0);
  });

  test("same faculty non-overlapping slots → no conflict", () => {
    const entries = [
      entry({ id: 1, facId: 30, slotId: 50, start: "09:00", end: "10:00" }),
      entry({ id: 2, facId: 30, slotId: 51, start: "10:00", end: "11:00", subId: 21 }),
    ];
    const c = checkFacultyConflict(entries, allSlots);
    expect(c.filter((x) => x.type === "FACULTY_CONFLICT")).toHaveLength(0);
  });

  test("partial overlap detected", () => {
    const partialSlots = [
      slot(60, "09:00", "10:00"),
      slot(61, "09:30", "10:30"),
    ];
    const entries = [
      entry({ id: 1, facId: 30, slotId: 60, start: "09:00", end: "10:00" }),
      entry({ id: 2, facId: 30, slotId: 61, start: "09:30", end: "10:30", subId: 21 }),
    ];
    const c = checkFacultyConflict(entries, partialSlots);
    expect(c.some((x) => x.type === "FACULTY_CONFLICT")).toBe(true);
  });

  test("excludeEntryId skips self-conflict", () => {
    const entries = [
      entry({ id: 1, facId: 30, slotId: 50 }),
      entry({ id: 2, facId: 30, slotId: 50, subId: 21 }),
    ];
    // Exclude entry id=2 — simulates editing that entry
    const c = checkFacultyConflict(entries, allSlots, makeId(2));
    expect(c.filter((x) => x.type === "FACULTY_CONFLICT")).toHaveLength(0);
  });
});

// ── 3. Room conflict ──────────────────────────────────────────────────────────

describe("checkRoomConflict", () => {
  test("same room overlapping slots → conflict", () => {
    const entries = [
      entry({ id: 1, roomId: 40, slotId: 50 }),
      entry({ id: 2, roomId: 40, slotId: 50, facId: 31, subId: 21 }),
    ];
    const c = checkRoomConflict(entries, allSlots);
    expect(c.some((x) => x.type === "ROOM_CONFLICT")).toBe(true);
  });

  test("different rooms same slot → no conflict", () => {
    const entries = [
      entry({ id: 1, roomId: 40, slotId: 50 }),
      entry({ id: 2, roomId: 41, slotId: 50, facId: 31, subId: 21 }),
    ];
    const c = checkRoomConflict(entries, allSlots);
    expect(c.filter((x) => x.type === "ROOM_CONFLICT")).toHaveLength(0);
  });

  test("same room non-overlapping slots → no conflict", () => {
    const entries = [
      entry({ id: 1, roomId: 40, slotId: 50, start: "09:00", end: "10:00" }),
      entry({ id: 2, roomId: 40, slotId: 51, start: "10:00", end: "11:00", facId: 31, subId: 21 }),
    ];
    const c = checkRoomConflict(entries, allSlots);
    expect(c.filter((x) => x.type === "ROOM_CONFLICT")).toHaveLength(0);
  });
});

// ── 4. Section conflict ───────────────────────────────────────────────────────

describe("checkSectionConflict", () => {
  test("same section overlapping slots → conflict", () => {
    const entries = [
      entry({ id: 1, secId: 10, slotId: 50 }),
      entry({ id: 2, secId: 10, slotId: 50, facId: 31, roomId: 41, subId: 21 }),
    ];
    const c = checkSectionConflict(entries, allSlots);
    expect(c.some((x) => x.type === "SECTION_CONFLICT")).toBe(true);
  });

  test("different sections same slot → no conflict", () => {
    const entries = [
      entry({ id: 1, secId: 10, slotId: 50 }),
      entry({ id: 2, secId: 11, slotId: 50, facId: 31, roomId: 41, subId: 21 }),
    ];
    const c = checkSectionConflict(entries, allSlots);
    expect(c.filter((x) => x.type === "SECTION_CONFLICT")).toHaveLength(0);
  });
});

// ── 5. Duplicate allocation ───────────────────────────────────────────────────

describe("checkDuplicateAllocation", () => {
  test("identical section+subject+day+slot → duplicate", () => {
    const entries = [
      entry({ id: 1, secId: 10, subId: 20, slotId: 50, day: "Monday" }),
      entry({ id: 2, secId: 10, subId: 20, slotId: 50, day: "Monday" }),
    ];
    const c = checkDuplicateAllocation(entries);
    expect(c.some((x) => x.type === "DUPLICATE_ALLOCATION")).toBe(true);
  });

  test("same subject different days → no duplicate", () => {
    const entries = [
      entry({ id: 1, secId: 10, subId: 20, slotId: 50, day: "Monday" }),
      entry({ id: 2, secId: 10, subId: 20, slotId: 50, day: "Tuesday" }),
    ];
    const c = checkDuplicateAllocation(entries);
    expect(c.filter((x) => x.type === "DUPLICATE_ALLOCATION")).toHaveLength(0);
  });
});

// ── 6. Faculty eligibility ────────────────────────────────────────────────────

describe("checkFacultyEligibility", () => {
  test("faculty not assigned to subject → error", () => {
    const entries = [entry({ id: 1, subId: 20, facId: 30 })];
    // Faculty teaches subject 99, not 20
    const faculty = [{ _id: makeId(30), name: "Dr. A", isActive: true, subjects: [{ _id: makeId(99) }], maxWeeklyHours: 20 }];
    const c = checkFacultyEligibility(entries, faculty);
    expect(c.some((x) => x.type === "FACULTY_NOT_ELIGIBLE")).toBe(true);
  });

  test("eligible faculty → no error", () => {
    const entries = [entry({ id: 1, subId: 20, facId: 30 })];
    const faculty = [{ _id: makeId(30), name: "Dr. A", isActive: true, subjects: [{ _id: makeId(20) }], maxWeeklyHours: 20 }];
    const c = checkFacultyEligibility(entries, faculty);
    expect(c.filter((x) => x.type === "FACULTY_NOT_ELIGIBLE")).toHaveLength(0);
  });

  test("inactive faculty → error", () => {
    const entries = [entry({ id: 1, subId: 20, facId: 30, facActive: false })];
    const faculty = [{ _id: makeId(30), name: "Dr. A", isActive: false, subjects: [{ _id: makeId(20) }], maxWeeklyHours: 20 }];
    const c = checkFacultyEligibility(entries, faculty);
    expect(c.some((x) => x.type === "INACTIVE_FACULTY")).toBe(true);
  });
});

// ── 7. Room suitability ───────────────────────────────────────────────────────

describe("checkRoomSuitability", () => {
  test("room capacity too small → error", () => {
    const entries = [entry({ id: 1, roomId: 40, cap: 10 })];
    const rooms = [{ _id: makeId(40), roomNumber: "A101", roomType: "Classroom", capacity: 10, isAvailable: true }];
    const subjects = [{ _id: makeId(20), name: "Maths", requiredRoomType: "Classroom" }];
    const c = checkRoomSuitability(entries, rooms, subjects, 60);
    expect(c.some((x) => x.type === "ROOM_CAPACITY")).toBe(true);
  });

  test("room type mismatch → error", () => {
    const entries = [entry({ id: 1, roomId: 40, roomKind: "Classroom", subType: "Lab", roomType: "Computer Lab" })];
    const rooms = [{ _id: makeId(40), roomNumber: "A101", roomType: "Classroom", capacity: 60, isAvailable: true }];
    const subjects = [{ _id: makeId(20), name: "OS Lab", requiredRoomType: "Computer Lab" }];
    const c = checkRoomSuitability(entries, rooms, subjects, 30);
    expect(c.some((x) => x.type === "ROOM_TYPE_MISMATCH")).toBe(true);
  });

  test("suitable room → no error", () => {
    const entries = [entry({ id: 1, roomId: 40 })];
    const rooms = [{ _id: makeId(40), roomNumber: "A101", roomType: "Classroom", capacity: 60, isAvailable: true }];
    const subjects = [{ _id: makeId(20), name: "Maths", requiredRoomType: "Classroom" }];
    const c = checkRoomSuitability(entries, rooms, subjects, 30);
    expect(c.filter((x) => x.severity === "error")).toHaveLength(0);
  });
});

// ── 8. Working day ────────────────────────────────────────────────────────────

describe("checkWorkingDay", () => {
  test("class on disabled day → error", () => {
    const entries = [entry({ id: 1, day: "Sunday" })];
    const c = checkWorkingDay(entries, enabledDays);
    expect(c.some((x) => x.type === "INVALID_WORKING_DAY")).toBe(true);
  });

  test("class on enabled day → no error", () => {
    const entries = [entry({ id: 1, day: "Monday" })];
    const c = checkWorkingDay(entries, enabledDays);
    expect(c.filter((x) => x.type === "INVALID_WORKING_DAY")).toHaveLength(0);
  });
});

// ── 9. Time slot validity ─────────────────────────────────────────────────────

describe("checkTimeSlotValidity", () => {
  test("class during break slot → error", () => {
    const breakEntry = entry({ id: 1, slotId: 53, start: "12:00", end: "13:00" });
    breakEntry.timeSlot = allSlots.find((s) => s._id === makeId(53));
    const c = checkTimeSlotValidity([breakEntry], allSlots);
    expect(c.some((x) => x.type === "CLASS_DURING_BREAK")).toBe(true);
  });

  test("valid active slot → no error", () => {
    const e = entry({ id: 1, slotId: 50 });
    e.timeSlot = allSlots.find((s) => s._id === makeId(50));
    const c = checkTimeSlotValidity([e], allSlots);
    expect(c.filter((x) => x.severity === "error")).toHaveLength(0);
  });
});

// ── 10. Lab continuity ────────────────────────────────────────────────────────

describe("checkLabContinuity", () => {
  test("lab with no additionalSlots → error", () => {
    const e = entry({ id: 1, isLab: true, slotId: 50, addSlots: [] });
    e.timeSlot = allSlots.find((s) => s._id === makeId(50));
    const c = checkLabContinuity([e], allSlots);
    expect(c.some((x) => x.type === "LAB_MISSING_CONSECUTIVE_SLOT")).toBe(true);
  });

  test("lab with consecutive slot → no error", () => {
    const e = entry({ id: 1, isLab: true, slotId: 50, addSlots: [{ _id: makeId(51) }] });
    e.timeSlot = allSlots.find((s) => s._id === makeId(50));
    e.additionalSlots = [allSlots.find((s) => s._id === makeId(51))];
    const c = checkLabContinuity([e], allSlots);
    expect(c.filter((x) => x.severity === "error")).toHaveLength(0);
  });

  test("lab with non-consecutive slot (gap) → error", () => {
    // slot 50 ends 10:00, slot 52 starts 11:00 — gap of 60 min
    const e = entry({ id: 1, isLab: true, slotId: 50, addSlots: [{ _id: makeId(52) }] });
    e.timeSlot = allSlots.find((s) => s._id === makeId(50));
    e.additionalSlots = [allSlots.find((s) => s._id === makeId(52))];
    const c = checkLabContinuity([e], allSlots);
    expect(c.some((x) => x.type === "LAB_NON_CONSECUTIVE_SLOTS")).toBe(true);
  });
});

// ── 11. Full validator integration ────────────────────────────────────────────

describe("validateTimetableFull", () => {
  const makeFullParams = (entries) => ({
    entries,
    allSlots,
    allFaculty: [{ _id: makeId(30), name: "Dr. A", isActive: true, subjects: [{ _id: makeId(20) }], maxWeeklyHours: 20 }],
    allRooms:   [{ _id: makeId(40), roomNumber: "A101", roomType: "Classroom", capacity: 60, isAvailable: true }],
    allSubjects:[{ _id: makeId(20), name: "Maths", code: "MA301", subjectType: "Theory", weeklyHours: 1, requiredRoomType: "Classroom" }],
    enabledDays,
    studentCount: 30,
  });

  test("clean single entry → valid", () => {
    const e = entry({ id: 1 });
    e.timeSlot = allSlots.find((s) => s._id === makeId(50));
    const r = validateTimetableFull(makeFullParams([e]));
    expect(r.valid).toBe(true);
    expect(r.errorCount).toBe(0);
  });

  test("faculty double-booked → invalid", () => {
    const e1 = entry({ id: 1, facId: 30, slotId: 50 });
    const e2 = entry({ id: 2, facId: 30, slotId: 50, subId: 21, roomId: 41 });
    e1.timeSlot = allSlots.find((s) => s._id === makeId(50));
    e2.timeSlot = allSlots.find((s) => s._id === makeId(50));
    const r = validateTimetableFull(makeFullParams([e1, e2]));
    expect(r.valid).toBe(false);
    expect(r.conflicts.some((c) => c.type === "FACULTY_CONFLICT")).toBe(true);
  });

  test("invalid timetable cannot be published (errorCount > 0)", () => {
    const e1 = entry({ id: 1, facId: 30, slotId: 50 });
    const e2 = entry({ id: 2, facId: 30, slotId: 50, subId: 21 });
    e1.timeSlot = allSlots.find((s) => s._id === makeId(50));
    e2.timeSlot = allSlots.find((s) => s._id === makeId(50));
    const r = validateTimetableFull(makeFullParams([e1, e2]));
    // Simulate publish guard
    expect(r.valid).toBe(false);
    expect(r.errorCount).toBeGreaterThan(0);
  });

  test("excludeEntryId prevents self-conflict on edit", () => {
    const e1 = entry({ id: 1, facId: 30, slotId: 50 });
    const e2 = entry({ id: 2, facId: 30, slotId: 50, subId: 21 });
    e1.timeSlot = allSlots.find((s) => s._id === makeId(50));
    e2.timeSlot = allSlots.find((s) => s._id === makeId(50));
    const r = validateTimetableFull({ ...makeFullParams([e1, e2]), excludeEntryId: makeId(2) });
    // With e2 excluded, no faculty conflict should be found
    expect(r.conflicts.filter((c) => c.type === "FACULTY_CONFLICT")).toHaveLength(0);
  });
});
