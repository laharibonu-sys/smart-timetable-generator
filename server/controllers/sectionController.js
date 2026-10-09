const Section = require("../models/Section");

const createError = (message, status = 400) => { const e = new Error(message); e.statusCode = status; return e; };

const getAll = async (req, res, next) => {
  try {
    const { search } = req.query;
    const filter = search ? { $or: [{ name: new RegExp(search, "i") }, { academicYear: new RegExp(search, "i") }] } : {};
    const sections = await Section.find(filter).populate("department", "name code").populate("classTeacher", "name employeeId").sort({ name: 1 });
    res.json({ success: true, data: sections });
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const section = await Section.findById(req.params.id).populate("department", "name code").populate("classTeacher", "name employeeId");
    if (!section) return next(createError("Section not found", 404));
    res.json({ success: true, data: section });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const section = await Section.create(req.body);
    const populated = await section.populate([{ path: "department", select: "name code" }, { path: "classTeacher", select: "name employeeId" }]);
    res.status(201).json({ success: true, data: populated });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const section = await Section.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate("department", "name code").populate("classTeacher", "name employeeId");
    if (!section) return next(createError("Section not found", 404));
    res.json({ success: true, data: section });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const section = await Section.findById(req.params.id);
    if (!section) return next(createError("Section not found", 404));
    await section.deleteOne();
    res.json({ success: true, message: "Section deleted" });
  } catch (err) { next(err); }
};

module.exports = { getAll, getOne, create, update, remove };
