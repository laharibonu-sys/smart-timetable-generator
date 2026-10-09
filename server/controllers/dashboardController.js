const Subject = require("../models/Subject");
const Faculty = require("../models/Faculty");
const Classroom = require("../models/Classroom");
const Department = require("../models/Department");
const Section = require("../models/Section");
const TimeSlot = require("../models/TimeSlot");
const WorkingDay = require("../models/WorkingDay");

const getStats = async (req, res, next) => {
  try {
    const [subjects, faculty, classrooms, departments, sections, timeSlots, workingDays] = await Promise.all([
      Subject.countDocuments(),
      Faculty.countDocuments(),
      Classroom.countDocuments(),
      Department.countDocuments(),
      Section.countDocuments(),
      TimeSlot.countDocuments({ isActive: true }),
      WorkingDay.countDocuments({ isWorkingDay: true }),
    ]);
    res.json({ success: true, data: { subjects, faculty, classrooms, departments, sections, timeSlots, workingDays } });
  } catch (err) { next(err); }
};

const getCharts = async (req, res, next) => {
  try {
    const facultyByDept = await Faculty.aggregate([
      { $group: { _id: "$department", count: { $sum: 1 } } },
      { $lookup: { from: "departments", localField: "_id", foreignField: "_id", as: "dept" } },
      { $unwind: { path: "$dept", preserveNullAndEmptyArrays: true } },
      { $project: { name: { $ifNull: ["$dept.name", "Unknown"] }, count: 1 } },
    ]);

    const classroomsByType = await Classroom.aggregate([
      { $group: { _id: "$roomType", count: { $sum: 1 } } },
      { $project: { name: "$_id", count: 1, _id: 0 } },
    ]);

    const subjectsByDept = await Subject.aggregate([
      { $group: { _id: "$department", count: { $sum: 1 } } },
      { $lookup: { from: "departments", localField: "_id", foreignField: "_id", as: "dept" } },
      { $unwind: { path: "$dept", preserveNullAndEmptyArrays: true } },
      { $project: { name: { $ifNull: ["$dept.name", "Unknown"] }, count: 1 } },
    ]);

    res.json({ success: true, data: { facultyByDept, classroomsByType, subjectsByDept } });
  } catch (err) { next(err); }
};

const getRecentActivity = async (req, res, next) => {
  try {
    const limit = 5;
    const [recentSubjects, recentFaculty, recentClassrooms, recentDepts] = await Promise.all([
      Subject.find().sort({ createdAt: -1 }).limit(limit).populate("department", "name").select("name code createdAt"),
      Faculty.find().sort({ createdAt: -1 }).limit(limit).select("name employeeId createdAt"),
      Classroom.find().sort({ createdAt: -1 }).limit(limit).select("roomNumber roomType createdAt"),
      Department.find().sort({ createdAt: -1 }).limit(limit).select("name code createdAt"),
    ]);

    const activity = [
      ...recentSubjects.map((s) => ({ type: "Subject", label: `${s.name} (${s.code})`, time: s.createdAt })),
      ...recentFaculty.map((f) => ({ type: "Faculty", label: `${f.name} (${f.employeeId})`, time: f.createdAt })),
      ...recentClassrooms.map((c) => ({ type: "Classroom", label: `${c.roomNumber} - ${c.roomType}`, time: c.createdAt })),
      ...recentDepts.map((d) => ({ type: "Department", label: `${d.name} (${d.code})`, time: d.createdAt })),
    ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 10);

    res.json({ success: true, data: activity });
  } catch (err) { next(err); }
};

module.exports = { getStats, getCharts, getRecentActivity };
