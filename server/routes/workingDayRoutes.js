const express = require("express");
const router = express.Router();
const { getAll, getOne, create, update, remove, bulkUpdate } = require("../controllers/workingDayController");
const { protect, adminOnly } = require("../middleware/auth");

router.use(protect);
router.get("/", getAll);
router.get("/:id", getOne);
router.post("/", adminOnly, create);
router.put("/bulk", adminOnly, bulkUpdate);
router.put("/:id", adminOnly, update);
router.delete("/:id", adminOnly, remove);

module.exports = router;
