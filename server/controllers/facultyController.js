const Faculty = require("../models/Faculty");

const createError = (message, status = 400) => { const e = new Error(message); e.statusCode = status; return e; };

const getAll = async (req, res, next) => {
  try {
    const { search } = req.query;
    const filter = search ? { $or: [{ name: new RegExp(search, "i") }, { employeeId: new RegExp(search, "i") }, { email: new RegExp(search, "i") }] } : {};
    const faculty = await Faculty.find(filter).populate("department", "name code").populate("subjects", "name code").sort({ name: 1 });
    res.json({ success: true, data: faculty });
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const faculty = await Faculty.findById(req.params.id).populate("department", "name code").populate("subjects", "name code");
    if (!faculty) return next(createError("Faculty not found", 404));
    res.json({ success: true, data: faculty });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const faculty = await Faculty.create(req.body);
    const populated = await faculty.populate([{ path: "department", select: "name code" }, { path: "subjects", select: "name code" }]);
    res.status(201).json({ success: true, data: populated });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const faculty = await Faculty.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate("department", "name code").populate("subjects", "name code");
    if (!faculty) return next(createError("Faculty not found", 404));
    res.json({ success: true, data: faculty });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const faculty = await Faculty.findById(req.params.id);
    if (!faculty) return next(createError("Faculty not found", 404));
    await faculty.deleteOne();
    res.json({ success: true, message: "Faculty deleted" });
  } catch (err) { next(err); }
};

module.exports = { getAll, getOne, create, update, remove };
