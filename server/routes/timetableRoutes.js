const express = require("express");
const router  = express.Router();
const {
  generate, getAll, getOne, validate, checkEntry,
  publish, archive, restore,
  editAssignment, regenerate, remove,
  exportCSV, getAuditLog,
  getReadiness, getMySchedule, getMySection, viewTimetables,
} = require("../controllers/timetableController");
const { protect, adminOnly, authorizeRoles } = require("../middleware/auth");

router.use(protect);

// Static routes (must come before /:id)
router.get("/readiness",   adminOnly,                                   getReadiness);
router.get("/my-schedule", authorizeRoles("faculty"),                   getMySchedule);
router.get("/my-section",  authorizeRoles("student"),                   getMySection);
router.get("/view",        adminOnly,                                   viewTimetables);
router.get("/",            authorizeRoles("admin","faculty","student"), getAll);

router.post("/generate",    adminOnly, generate);
router.post("/check-entry", adminOnly, checkEntry);

// Parameterised routes
router.get("/:id",                              authorizeRoles("admin","faculty","student"), getOne);
router.post("/:id/validate",                    adminOnly, validate);
router.patch("/:id/publish",                    adminOnly, publish);
router.patch("/:id/archive",                    adminOnly, archive);
router.patch("/:id/restore",                    adminOnly, restore);
router.post("/:id/regenerate",                  adminOnly, regenerate);
router.patch("/:id/assignments/:assignmentId",  adminOnly, editAssignment);
router.get("/:id/export/csv",                   authorizeRoles("admin","faculty","student"), exportCSV);
router.get("/:id/audit",                        adminOnly, getAuditLog);
router.delete("/:id",                           adminOnly, remove);

module.exports = router;
