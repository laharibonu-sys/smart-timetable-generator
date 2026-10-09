const Classroom = require("../models/Classroom");

const createError = (message, status = 400) => { const e = new Error(message); e.statusCode = status; return e; };

const getAll = async (req, res, next) => {
  try {
    const { search } = req.query;
    const filter = search ? { $or: [{ roomNumber: new RegExp(search, "i") }, { building: new RegExp(search, "i") }] } : {};
    const classrooms = await Classroom.find(filter).sort({ roomNumber: 1 });
    res.json({ success: true, data: classrooms });
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const room = await Classroom.findById(req.params.id);
    if (!room) return next(createError("Classroom not found", 404));
    res.json({ success: true, data: room });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    if (req.body.equipment && typeof req.body.equipment === "string") {
      req.body.equipment = req.body.equipment.split(",").map((e) => e.trim()).filter(Boolean);
    }
    const room = await Classroom.create(req.body);
    res.status(201).json({ success: true, data: room });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    if (req.body.equipment && typeof req.body.equipment === "string") {
      req.body.equipment = req.body.equipment.split(",").map((e) => e.trim()).filter(Boolean);
    }
    const room = await Classroom.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!room) return next(createError("Classroom not found", 404));
    res.json({ success: true, data: room });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const room = await Classroom.findById(req.params.id);
    if (!room) return next(createError("Classroom not found", 404));
    await room.deleteOne();
    res.json({ success: true, message: "Classroom deleted" });
  } catch (err) { next(err); }
};

module.exports = { getAll, getOne, create, update, remove };
