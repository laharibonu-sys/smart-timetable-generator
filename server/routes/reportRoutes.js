const express = require("express");
const router = express.Router();
const {
  getSummary,
  getFacultyWorkload,
  getClassroomUtilization,
  getSchedulingCompletion,
  getConflicts,
  getDepartmentSummary,
  revalidate,
} = require("../controllers/reportController");
const { protect, adminOnly } = require("../middleware/auth");

router.use(protect, adminOnly);

router.get("/summary",                getSummary);
router.get("/faculty-workload",       getFacultyWorkload);
router.get("/classroom-utilization",  getClassroomUtilization);
router.get("/scheduling-completion",  getSchedulingCompletion);
router.get("/conflicts",              getConflicts);
router.get("/department-summary",     getDepartmentSummary);
router.post("/revalidate/:timetableId", revalidate);

module.exports = router;
