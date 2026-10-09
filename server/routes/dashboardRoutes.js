const express = require("express");
const router = express.Router();
const { getStats, getCharts, getRecentActivity } = require("../controllers/dashboardController");
const { protect } = require("../middleware/auth");

router.get("/stats", protect, getStats);
router.get("/charts", protect, getCharts);
router.get("/recent-activity", protect, getRecentActivity);

module.exports = router;
