const Subject = require("../models/Subject");

const createError = (message, status = 400) => { const e = new Error(message); e.statusCode = status; return e; };

const getAll = async (req, res, next) => {
  try {
    const { search } = req.query;
    const filter = search ? { $or: [{ name: new RegExp(search, "i") }, { code: new RegExp(search, "i") }] } : {};
    const subjects = await Subject.find(filter).populate("department", "name code").sort({ name: 1 });
    res.json({ success: true, data: subjects });
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const subject = await Subject.findById(req.params.id).populate("department", "name code");
    if (!subject) return next(createError("Subject not found", 404));
    res.json({ success: true, data: subject });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const subject = await Subject.create(req.body);
    const populated = await subject.populate("department", "name code");
    res.status(201).json({ success: true, data: populated });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const subject = await Subject.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).populate("department", "name code");
    if (!subject) return next(createError("Subject not found", 404));
    res.json({ success: true, data: subject });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) return next(createError("Subject not found", 404));
    await subject.deleteOne();
    res.json({ success: true, message: "Subject deleted" });
  } catch (err) { next(err); }
};

module.exports = { getAll, getOne, create, update, remove };
