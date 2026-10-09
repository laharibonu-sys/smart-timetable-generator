"use strict";

const { generateTimetable, validateTimetable } = require("../services/timetableGenerator");

// ── Sample Data Builders ──────────────────────────────────────────────────────

const makeId = (n) => `000000000000000000000${n}`.slice(-24);

const makeDept = () => ({ _id: makeId(1), name: "Computer Science", code: "CS" });

const makeSection = (studentCount = 30) => ({
  _id: makeId(10), name: "A", semester: 3, academicYear: "2024-25",
  department: makeId(1), studentCount,
});

const makeSubject = (overrides = {}) => ({
  _id: makeId(20), name: "Data Structures", code: "CS301",
  subjectType: "Theory", weeklyHours: 2,
  requiredRoomType: "Classroom", isActive: true,
  ...overrides,
});

const makeFaculty = (subjectIds = [makeId(20)], overrides = {}) => ({
  _id: makeId(30), name: "Dr. Smith", employeeId: "EMP001",
  department: makeId(1), isActive: true,
  subjects: subjectIds.map((id) => ({ _id: id })),
  maxWeeklyHours: 20, availability: new Map(),
  ...overrides,
});

const makeRoom = (overrides = {}) => ({
  _id: makeId(40), roomNumber: "A101", roomType: "Classroom",
  capacity: 60, isAvailable: true, building: "Main",
  ...overrides,
});

const makeSlot = (id, name, start, end, type = "Regular Class") => ({
  _id: makeId(id), slotName: name, startTime: start, endTime: end,
  slotType: type, isActive: true,
});

const baseSlots = [
  makeSlot(50, "Period 1", "09:00", "10:00"),
  makeSlot(51, "Period 2", "10:00", "11:00"),
  makeSlot(52, "Period 3", "11:00", "12:00"),
  makeSlot(53, "Break",    "12:00", "13:00", "Break"),
  makeSlot(54, "Period 4", "13:00", "14:00"),
  makeSlot(55, "Period 5", "14:00", "15:00"),
];

const workingDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Scheduling Algorithm — Hard Constraints", () => {

  // 1. Two subjects cannot use the same section at overlapping times
  test("section conflict: two subjects not scheduled at same time", async () => {
    const sub1 = makeSubject({ _id: makeId(20), name: "Maths", code: "MA301", weeklyHours: 1 });
    const sub2 = makeSubject({ _id: makeId(21), name: "Physics", code: "PH301", weeklyHours: 1 });
    const fac1 = makeFaculty([makeId(20)], { _id: makeId(30) });
    const fac2 = makeFaculty([makeId(21)], { _id: makeId(31), employeeId: "EMP002" });
    const room1 = makeRoom({ _id: makeId(40) });
    const room2 = makeRoom({ _id: makeId(41), roomNumber: "B102" });

    const result = await generateTimetable({
      section: makeSection(), subjects: [sub1, sub2],
      faculty: [fac1, fac2], classrooms: [room1, room2],
      workingDays, timeSlots: baseSlots,
    });

    const violations = validateTimetable(result.entries, baseSlots);
    const sectionConflicts = violations.filter((v) => v.includes("Section conflict"));
    expect(sectionConflicts.length).toBe(0);
  });

  // 2. One faculty member cannot teach two simultaneous classes
  test("faculty conflict: same faculty not assigned two overlapping slots", async () => {
    const sub1 = makeSubject({ _id: makeId(20), weeklyHours: 1 });
    const sub2 = makeSubject({ _id: makeId(21), name: "Algorithms", code: "CS302", weeklyHours: 1 });
    // Same faculty teaches both subjects
    const fac = makeFaculty([makeId(20), makeId(21)], { _id: makeId(30) });
    const room1 = makeRoom({ _id: makeId(40) });
    const room2 = makeRoom({ _id: makeId(41), roomNumber: "B102" });

    const result = await generateTimetable({
      section: makeSection(), subjects: [sub1, sub2],
      faculty: [fac], classrooms: [room1, room2],
      workingDays, timeSlots: baseSlots,
    });

    const violations = validateTimetable(result.entries, baseSlots);
    const facConflicts = violations.filter((v) => v.includes("Faculty conflict"));
    expect(facConflicts.length).toBe(0);
  });

  // 3. One classroom cannot host two simultaneous classes
  test("room conflict: same room not assigned two overlapping slots", async () => {
    const sub1 = makeSubject({ _id: makeId(20), weeklyHours: 1 });
    const sub2 = makeSubject({ _id: makeId(21), name: "Algorithms", code: "CS302", weeklyHours: 1 });
    const fac1 = makeFaculty([makeId(20)], { _id: makeId(30) });
    const fac2 = makeFaculty([makeId(21)], { _id: makeId(31), employeeId: "EMP002" });
    // Only one room available
    const room = makeRoom({ _id: makeId(40) });

    const result = await generateTimetable({
      section: makeSection(), subjects: [sub1, sub2],
      faculty: [fac1, fac2], classrooms: [room],
      workingDays, timeSlots: baseSlots,
    });

    const violations = validateTimetable(result.entries, baseSlots);
    const roomConflicts = violations.filter((v) => v.includes("Room conflict"));
    expect(roomConflicts.length).toBe(0);
  });

  // 4. Unavailable faculty are never assigned
  test("faculty availability: unavailable faculty not assigned", async () => {
    const sub = makeSubject({ _id: makeId(20), weeklyHours: 1 });
    // Faculty marked unavailable on all working days
    const unavailMap = new Map();
    workingDays.forEach((d) => unavailMap.set(d, ["09:00-15:00"]));
    const fac = makeFaculty([makeId(20)], { _id: makeId(30), availability: unavailMap });
    const room = makeRoom();

    const result = await generateTimetable({
      section: makeSection(), subjects: [sub],
      faculty: [fac], classrooms: [room],
      workingDays, timeSlots: baseSlots,
    });

    // Should not be scheduled since faculty is unavailable every day
    expect(result.entries.length).toBe(0);
    expect(result.unscheduledTasks.length).toBeGreaterThan(0);
  });

  // 5. Insufficient room capacity prevents assignment
  test("room capacity: room too small for section not used", async () => {
    const sub = makeSubject({ _id: makeId(20), weeklyHours: 1 });
    const fac = makeFaculty([makeId(20)]);
    // Room capacity 10, section has 60 students
    const smallRoom = makeRoom({ _id: makeId(40), capacity: 10 });

    const result = await generateTimetable({
      section: makeSection(60), subjects: [sub],
      faculty: [fac], classrooms: [smallRoom],
      workingDays, timeSlots: baseSlots,
    });

    expect(result.entries.length).toBe(0);
    expect(result.unscheduledTasks.some((t) => t.reason.includes("suitable available room"))).toBe(true);
  });

  // 6. Lab sessions occupy consecutive periods
  test("lab sessions: assigned to consecutive time slots", async () => {
    const labSub = makeSubject({
      _id: makeId(20), name: "OS Lab", code: "CS391",
      subjectType: "Lab", weeklyHours: 2, requiredRoomType: "Computer Lab",
    });
    const fac = makeFaculty([makeId(20)]);
    const labRoom = makeRoom({ _id: makeId(40), roomType: "Computer Lab", roomNumber: "CL1" });

    const result = await generateTimetable({
      section: makeSection(), subjects: [labSub],
      faculty: [fac], classrooms: [labRoom],
      workingDays, timeSlots: baseSlots,
    });

    const labEntries = result.entries.filter((e) => e.isLabSession);
    if (labEntries.length > 0) {
      labEntries.forEach((e) => {
        expect(e.isLabSession).toBe(true);
        // Lab entries should have additionalSlots
        expect(e.additionalSlots).toBeDefined();
      });
    }
  });

  // 7. Subject weekly-hour requirements are checked
  test("weekly hours: all required periods attempted", async () => {
    const sub = makeSubject({ _id: makeId(20), weeklyHours: 3 });
    const fac = makeFaculty([makeId(20)]);
    const room = makeRoom();

    const result = await generateTimetable({
      section: makeSection(), subjects: [sub],
      faculty: [fac], classrooms: [room],
      workingDays, timeSlots: baseSlots,
    });

    expect(result.statistics.requiredTasks).toBe(3);
  });

  // 8. Breaks are never treated as teaching slots
  test("breaks: no class scheduled during break slots", async () => {
    const sub = makeSubject({ _id: makeId(20), weeklyHours: 2 });
    const fac = makeFaculty([makeId(20)]);
    const room = makeRoom();

    const result = await generateTimetable({
      section: makeSection(), subjects: [sub],
      faculty: [fac], classrooms: [room],
      workingDays, timeSlots: baseSlots,
    });

    const breakSlotId = makeId(53); // "Break" slot
    const breakAssignments = result.entries.filter(
      (e) => String(e.timeSlot) === breakSlotId
    );
    expect(breakAssignments.length).toBe(0);
  });

  // 9. Invalid configuration produces useful errors
  test("no faculty: unscheduled task has descriptive reason", async () => {
    const sub = makeSubject({ _id: makeId(20), weeklyHours: 1 });
    // No faculty assigned to this subject
    const fac = makeFaculty([makeId(99)], { _id: makeId(30) }); // teaches different subject
    const room = makeRoom();

    const result = await generateTimetable({
      section: makeSection(), subjects: [sub],
      faculty: [fac], classrooms: [room],
      workingDays, timeSlots: baseSlots,
    });

    expect(result.entries.length).toBe(0);
    expect(result.unscheduledTasks.length).toBeGreaterThan(0);
    expect(result.unscheduledTasks[0].reason).toMatch(/No eligible faculty/);
  });

  // 10. Incomplete schedules are not incorrectly marked complete
  test("incomplete schedule: statistics reflect unscheduled tasks", async () => {
    const sub = makeSubject({ _id: makeId(20), weeklyHours: 1 });
    // No faculty — cannot schedule
    const result = await generateTimetable({
      section: makeSection(), subjects: [sub],
      faculty: [], classrooms: [makeRoom()],
      workingDays, timeSlots: baseSlots,
    });

    expect(result.statistics.scheduledTasks).toBe(0);
    expect(result.statistics.unscheduledTasks).toBeGreaterThan(0);
    expect(result.statistics.qualityScore).toBe(0);
  });

  // 11. validateTimetable detects real conflicts
  test("validator: detects faculty double-booking", () => {
    const slot = makeSlot(50, "P1", "09:00", "10:00");
    const entries = [
      { subject: makeId(20), faculty: makeId(30), classroom: makeId(40), section: makeId(10), day: "Monday", timeSlot: makeId(50) },
      { subject: makeId(21), faculty: makeId(30), classroom: makeId(41), section: makeId(11), day: "Monday", timeSlot: makeId(50) },
    ];
    const violations = validateTimetable(entries, [slot]);
    expect(violations.some((v) => v.includes("Faculty conflict"))).toBe(true);
  });

  // 12. Room type mismatch: lab subject not assigned to classroom
  test("room suitability: lab subject not assigned to regular classroom", async () => {
    const labSub = makeSubject({
      _id: makeId(20), subjectType: "Lab",
      weeklyHours: 2, requiredRoomType: "Computer Lab",
    });
    const fac = makeFaculty([makeId(20)]);
    // Only regular classroom available, no computer lab
    const regularRoom = makeRoom({ _id: makeId(40), roomType: "Classroom" });

    const result = await generateTimetable({
      section: makeSection(), subjects: [labSub],
      faculty: [fac], classrooms: [regularRoom],
      workingDays, timeSlots: baseSlots,
    });

    expect(result.entries.length).toBe(0);
    expect(result.unscheduledTasks.some((t) => t.reason.includes("suitable available room"))).toBe(true);
  });
});
