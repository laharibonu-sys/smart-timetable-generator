const Department = require("../models/Department");

const createError = (message, status = 400) => { const e = new Error(message); e.statusCode = status; return e; };

const getAll = async (req, res, next) => {
  try {
    const { search } = req.query;
    const filter = search ? { $or: [{ name: new RegExp(search, "i") }, { code: new RegExp(search, "i") }] } : {};
    const departments = await Department.find(filter).sort({ name: 1 });
    res.json({ success: true, data: departments });
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const dept = await Department.findById(req.params.id);
    if (!dept) return next(createError("Department not found", 404));
    res.json({ success: true, data: dept });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const dept = await Department.create(req.body);
    res.status(201).json({ success: true, data: dept });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const dept = await Department.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!dept) return next(createError("Department not found", 404));
    res.json({ success: true, data: dept });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const dept = await Department.findById(req.params.id);
    if (!dept) return next(createError("Department not found", 404));
    await dept.deleteOne();
    res.json({ success: true, message: "Department deleted" });
  } catch (err) { next(err); }
};

module.exports = { getAll, getOne, create, update, remove };
