const TimeSlot = require("../models/TimeSlot");

const createError = (message, status = 400) => { const e = new Error(message); e.statusCode = status; return e; };
const toMinutes = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

const hasOverlap = async (startTime, endTime, excludeId = null) => {
  const slots = await TimeSlot.find({ isActive: true, slotType: { $ne: "Break" }, ...(excludeId && { _id: { $ne: excludeId } }) });
  const newStart = toMinutes(startTime);
  const newEnd = toMinutes(endTime);
  return slots.some((s) => newStart < toMinutes(s.endTime) && newEnd > toMinutes(s.startTime));
};

const getAll = async (req, res, next) => {
  try {
    const slots = await TimeSlot.find().sort({ startTime: 1 });
    res.json({ success: true, data: slots });
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const slot = await TimeSlot.findById(req.params.id);
    if (!slot) return next(createError("Time slot not found", 404));
    res.json({ success: true, data: slot });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const { startTime, endTime, slotType, isActive } = req.body;
    if (isActive !== false && slotType !== "Break") {
      if (await hasOverlap(startTime, endTime)) return next(createError("This time slot overlaps with an existing active teaching slot"));
    }
    const slot = await TimeSlot.create(req.body);
    res.status(201).json({ success: true, data: slot });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const { startTime, endTime, slotType, isActive } = req.body;
    if (isActive !== false && slotType !== "Break") {
      if (await hasOverlap(startTime, endTime, req.params.id)) return next(createError("This time slot overlaps with an existing active teaching slot"));
    }
    const slot = await TimeSlot.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!slot) return next(createError("Time slot not found", 404));
    res.json({ success: true, data: slot });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const slot = await TimeSlot.findById(req.params.id);
    if (!slot) return next(createError("Time slot not found", 404));
    await slot.deleteOne();
    res.json({ success: true, message: "Time slot deleted" });
  } catch (err) { next(err); }
};

module.exports = { getAll, getOne, create, update, remove };
