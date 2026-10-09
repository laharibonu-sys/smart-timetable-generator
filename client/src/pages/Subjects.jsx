import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { subjectsAPI, departmentsAPI } from "../services/api";
import { LoadingState, EmptyState } from "../components/States";
import ConfirmDialog from "../components/ConfirmDialog";
import Alert from "../components/Alert";
import Pagination from "../components/Pagination";

const PAGE_SIZE = 10;
const empty = { name: "", code: "", department: "", semester: "", subjectType: "Theory", weeklyHours: "", requiredRoomType: "Classroom", isActive: true };

const typeColors = { Theory: "badge-info", Practical: "badge-warning", Lab: "badge-purple" };

export default function Subjects() {
  const [data, setData] = useState([]);
  const [depts, setDepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [alert, setAlert] = useState(null);
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [subRes, deptRes] = await Promise.all([subjectsAPI.getAll({ search }), departmentsAPI.getAll()]);
      setData(subRes.data.data);
      setDepts(deptRes.data.data);
      setPage(1);
    } catch { setAlert({ type: "error", message: "Failed to load subjects" }); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.code.trim()) e.code = "Code is required";
    if (!form.department) e.department = "Department is required";
    if (!form.semester) e.semester = "Semester is required";
    if (!form.weeklyHours || form.weeklyHours < 1 || form.weeklyHours > 20) e.weeklyHours = "Weekly hours must be 1–20";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const openAdd = () => { setForm(empty); setEditId(null); setErrors({}); setModal(true); };
  const openEdit = (s) => {
    setForm({ name: s.name, code: s.code, department: s.department?._id || s.department, semester: s.semester, subjectType: s.subjectType, weeklyHours: s.weeklyHours, requiredRoomType: s.requiredRoomType, isActive: s.isActive });
    setEditId(s._id); setErrors({}); setModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (editId) await subjectsAPI.update(editId, form);
      else await subjectsAPI.create(form);
      setAlert({ type: "success", message: `Subject ${editId ? "updated" : "created"} successfully` });
      setModal(false); fetchData();
    } catch (err) { setAlert({ type: "error", message: err.response?.data?.message || "Save failed" }); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await subjectsAPI.remove(deleteId);
      setAlert({ type: "success", message: "Subject deleted" });
      setDeleteId(null); fetchData();
    } catch (err) { setAlert({ type: "error", message: err.response?.data?.message || "Delete failed" }); }
    finally { setDeleting(false); }
  };

  const paged = data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <div className="page-header">
        <h1>Subjects</h1>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Add Subject</button>
      </div>
      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

      <div className="table-container">
        <div className="table-toolbar">
          <div className="search-bar"><Search size={15} color="var(--text-secondary)" /><input placeholder="Search subjects..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{data.length} record{data.length !== 1 ? "s" : ""}</span>
        </div>
        {loading ? <LoadingState /> : paged.length === 0 ? (
          <EmptyState title="No subjects found" message="Add your first subject." action={<button className="btn btn-primary" onClick={openAdd}><Plus size={14} /> Add Subject</button>} />
        ) : (
          <>
            <table>
              <thead><tr><th>Name</th><th>Code</th><th>Department</th><th>Sem</th><th>Type</th><th>Hrs/Wk</th><th>Room Type</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {paged.map((s) => (
                  <tr key={s._id}>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td><span className="badge badge-purple">{s.code}</span></td>
                    <td>{s.department?.name || "—"}</td>
                    <td>{s.semester}</td>
                    <td><span className={`badge ${typeColors[s.subjectType] || "badge-info"}`}>{s.subjectType}</span></td>
                    <td>{s.weeklyHours}</td>
                    <td>{s.requiredRoomType}</td>
                    <td><span className={`badge ${s.isActive ? "badge-success" : "badge-danger"}`}>{s.isActive ? "Active" : "Inactive"}</span></td>
                    <td><div className="table-actions">
                      <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(s)}><Pencil size={14} /></button>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeleteId(s._id)}><Trash2 size={14} /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} totalPages={Math.ceil(data.length / PAGE_SIZE)} total={data.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </div>

      {modal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header"><h2>{editId ? "Edit Subject" : "Add Subject"}</h2><button className="icon-btn" onClick={() => setModal(false)}>✕</button></div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Subject Name *</label>
                    <input className={errors.name ? "error" : ""} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Data Structures" />
                    {errors.name && <div className="field-error">{errors.name}</div>}
                  </div>
                  <div className="form-group">
                    <label>Subject Code *</label>
                    <input className={errors.code ? "error" : ""} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="e.g. CS301" />
                    {errors.code && <div className="field-error">{errors.code}</div>}
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Department *</label>
                    <select className={errors.department ? "error" : ""} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                      <option value="">Select department</option>
                      {depts.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                    </select>
                    {errors.department && <div className="field-error">{errors.department}</div>}
                  </div>
                  <div className="form-group">
                    <label>Semester *</label>
                    <select className={errors.semester ? "error" : ""} value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })}>
                      <option value="">Select semester</option>
                      {[1,2,3,4,5,6,7,8].map((s) => <option key={s} value={s}>Semester {s}</option>)}
                    </select>
                    {errors.semester && <div className="field-error">{errors.semester}</div>}
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Subject Type *</label>
                    <select value={form.subjectType} onChange={(e) => setForm({ ...form, subjectType: e.target.value })}>
                      <option>Theory</option><option>Practical</option><option>Lab</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Weekly Hours *</label>
                    <input type="number" min={1} max={20} className={errors.weeklyHours ? "error" : ""} value={form.weeklyHours} onChange={(e) => setForm({ ...form, weeklyHours: e.target.value })} placeholder="e.g. 4" />
                    {errors.weeklyHours && <div className="field-error">{errors.weeklyHours}</div>}
                  </div>
                </div>
                <div className="form-group">
                  <label>Required Room Type</label>
                  <select value={form.requiredRoomType} onChange={(e) => setForm({ ...form, requiredRoomType: e.target.value })}>
                    <option>Classroom</option><option>Computer Lab</option><option>Science Lab</option><option>Any</option>
                  </select>
                </div>
                <div className="form-check">
                  <input type="checkbox" id="subActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                  <label htmlFor="subActive">Active</label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : editId ? "Update" : "Create"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmDialog isOpen={!!deleteId} title="Delete Subject" message="Delete this subject? Faculty assignments referencing it will be affected." onConfirm={handleDelete} onCancel={() => setDeleteId(null)} loading={deleting} />
    </div>
  );
}
