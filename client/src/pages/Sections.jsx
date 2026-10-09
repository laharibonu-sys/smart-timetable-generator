import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { sectionsAPI, departmentsAPI, facultyAPI } from "../services/api";
import { LoadingState, EmptyState } from "../components/States";
import ConfirmDialog from "../components/ConfirmDialog";
import Alert from "../components/Alert";
import Pagination from "../components/Pagination";

const PAGE_SIZE = 10;
const empty = { name: "", department: "", academicYear: "", semester: "", studentCount: 0, classTeacher: "", isActive: true };

export default function Sections() {
  const [data, setData] = useState([]);
  const [depts, setDepts] = useState([]);
  const [faculty, setFaculty] = useState([]);
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
      const [secRes, deptRes, facRes] = await Promise.all([sectionsAPI.getAll({ search }), departmentsAPI.getAll(), facultyAPI.getAll()]);
      setData(secRes.data.data); setDepts(deptRes.data.data); setFaculty(facRes.data.data); setPage(1);
    } catch { setAlert({ type: "error", message: "Failed to load sections" }); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Section name is required";
    if (!form.department) e.department = "Department is required";
    if (!form.academicYear.trim()) e.academicYear = "Academic year is required";
    if (!form.semester) e.semester = "Semester is required";
    setErrors(e); return Object.keys(e).length === 0;
  };

  const openAdd = () => { setForm(empty); setEditId(null); setErrors({}); setModal(true); };
  const openEdit = (s) => {
    setForm({ name: s.name, department: s.department?._id || s.department, academicYear: s.academicYear, semester: s.semester, studentCount: s.studentCount, classTeacher: s.classTeacher?._id || s.classTeacher || "", isActive: s.isActive });
    setEditId(s._id); setErrors({}); setModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    const payload = { ...form };
    if (!payload.classTeacher) delete payload.classTeacher;
    try {
      if (editId) await sectionsAPI.update(editId, payload);
      else await sectionsAPI.create(payload);
      setAlert({ type: "success", message: `Section ${editId ? "updated" : "created"} successfully` });
      setModal(false); fetchData();
    } catch (err) { setAlert({ type: "error", message: err.response?.data?.message || "Save failed" }); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await sectionsAPI.remove(deleteId);
      setAlert({ type: "success", message: "Section deleted" });
      setDeleteId(null); fetchData();
    } catch (err) { setAlert({ type: "error", message: err.response?.data?.message || "Delete failed" }); }
    finally { setDeleting(false); }
  };

  const paged = data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <div className="page-header">
        <h1>Sections</h1>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Add Section</button>
      </div>
      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

      <div className="table-container">
        <div className="table-toolbar">
          <div className="search-bar"><Search size={15} color="var(--text-secondary)" /><input placeholder="Search sections..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{data.length} record{data.length !== 1 ? "s" : ""}</span>
        </div>
        {loading ? <LoadingState /> : paged.length === 0 ? (
          <EmptyState title="No sections found" message="Add your first section." action={<button className="btn btn-primary" onClick={openAdd}><Plus size={14} /> Add Section</button>} />
        ) : (
          <>
            <table>
              <thead><tr><th>Section</th><th>Department</th><th>Academic Year</th><th>Semester</th><th>Students</th><th>Class Teacher</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {paged.map((s) => (
                  <tr key={s._id}>
                    <td style={{ fontWeight: 700 }}>{s.name}</td>
                    <td>{s.department?.name || "—"}</td>
                    <td>{s.academicYear}</td>
                    <td>Sem {s.semester}</td>
                    <td>{s.studentCount}</td>
                    <td>{s.classTeacher?.name || "—"}</td>
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
            <div className="modal-header"><h2>{editId ? "Edit Section" : "Add Section"}</h2><button className="icon-btn" onClick={() => setModal(false)}>✕</button></div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Section Name *</label>
                    <input className={errors.name ? "error" : ""} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value.toUpperCase() })} placeholder="e.g. A" />
                    {errors.name && <div className="field-error">{errors.name}</div>}
                  </div>
                  <div className="form-group">
                    <label>Department *</label>
                    <select className={errors.department ? "error" : ""} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                      <option value="">Select department</option>
                      {depts.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                    </select>
                    {errors.department && <div className="field-error">{errors.department}</div>}
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Academic Year *</label>
                    <input className={errors.academicYear ? "error" : ""} value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} placeholder="e.g. 2024-25" />
                    {errors.academicYear && <div className="field-error">{errors.academicYear}</div>}
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
                    <label>Student Count</label>
                    <input type="number" min={0} value={form.studentCount} onChange={(e) => setForm({ ...form, studentCount: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Class Teacher (optional)</label>
                    <select value={form.classTeacher} onChange={(e) => setForm({ ...form, classTeacher: e.target.value })}>
                      <option value="">None</option>
                      {faculty.map((f) => <option key={f._id} value={f._id}>{f.name} ({f.employeeId})</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-check">
                  <input type="checkbox" id="secActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                  <label htmlFor="secActive">Active</label>
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
      <ConfirmDialog isOpen={!!deleteId} title="Delete Section" message="Delete this section?" onConfirm={handleDelete} onCancel={() => setDeleteId(null)} loading={deleting} />
    </div>
  );
}
