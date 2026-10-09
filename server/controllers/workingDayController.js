const WorkingDay = require("../models/WorkingDay");

const createError = (message, status = 400) => { const e = new Error(message); e.statusCode = status; return e; };

const getAll = async (req, res, next) => {
  try {
    const days = await WorkingDay.find().sort({ displayOrder: 1 });
    res.json({ success: true, data: days });
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const day = await WorkingDay.findById(req.params.id);
    if (!day) return next(createError("Working day not found", 404));
    res.json({ success: true, data: day });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const day = await WorkingDay.create(req.body);
    res.status(201).json({ success: true, data: day });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const day = await WorkingDay.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!day) return next(createError("Working day not found", 404));
    res.json({ success: true, data: day });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const day = await WorkingDay.findById(req.params.id);
    if (!day) return next(createError("Working day not found", 404));
    await day.deleteOne();
    res.json({ success: true, message: "Working day deleted" });
  } catch (err) { next(err); }
};

const bulkUpdate = async (req, res, next) => {
  try {
    const { days } = req.body;
    await Promise.all(days.map((d) => WorkingDay.findByIdAndUpdate(d._id, { isWorkingDay: d.isWorkingDay })));
    const updated = await WorkingDay.find().sort({ displayOrder: 1 });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
};

module.exports = { getAll, getOne, create, update, remove, bulkUpdate };
