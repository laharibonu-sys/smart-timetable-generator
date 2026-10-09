import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Search, X } from "lucide-react";
import { facultyAPI, departmentsAPI, subjectsAPI, workingDaysAPI } from "../services/api";
import { LoadingState, EmptyState } from "../components/States";
import ConfirmDialog from "../components/ConfirmDialog";
import Alert from "../components/Alert";
import Pagination from "../components/Pagination";

const PAGE_SIZE = 10;
const empty = { name: "", employeeId: "", email: "", department: "", specialization: "", subjects: [], maxWeeklyHours: 20, availability: {}, isActive: true };

export default function Faculty() {
  const [data, setData] = useState([]);
  const [depts, setDepts] = useState([]);
  const [allSubjects, setAllSubjects] = useState([]);
  const [workingDays, setWorkingDays] = useState([]);
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
      const [facRes, deptRes, subRes, wdRes] = await Promise.all([facultyAPI.getAll({ search }), departmentsAPI.getAll(), subjectsAPI.getAll(), workingDaysAPI.getAll()]);
      setData(facRes.data.data); setDepts(deptRes.data.data); setAllSubjects(subRes.data.data);
      setWorkingDays(wdRes.data.data.filter((d) => d.isWorkingDay).sort((a, b) => a.displayOrder - b.displayOrder));
      setPage(1);
    } catch { setAlert({ type: "error", message: "Failed to load faculty" }); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.employeeId.trim()) e.employeeId = "Employee ID is required";
    if (!form.email.trim()) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Invalid email";
    if (!form.department) e.department = "Department is required";
    setErrors(e); return Object.keys(e).length === 0;
  };

  const openAdd = () => { setForm(empty); setEditId(null); setErrors({}); setModal(true); };
  const openEdit = (f) => {
    // Convert availability Map/object to plain object { day: ["all"] }
    let avail = {};
    if (f.availability) {
      const entries = f.availability instanceof Map ? [...f.availability.entries()] : Object.entries(f.availability);
      entries.forEach(([day, slots]) => { if (slots && slots.length > 0) avail[day] = slots; });
    }
    setForm({ name: f.name, employeeId: f.employeeId, email: f.email, department: f.department?._id || f.department, specialization: f.specialization || "", subjects: f.subjects?.map((s) => s._id || s) || [], maxWeeklyHours: f.maxWeeklyHours, availability: avail, isActive: f.isActive });
    setEditId(f._id); setErrors({}); setModal(true);
  };

  const toggleUnavailableDay = (day) => {
    setForm((prev) => {
      const avail = { ...prev.availability };
      if (avail[day]) delete avail[day];
      else avail[day] = ["all"];
      return { ...prev, availability: avail };
    });
  };

  const toggleSubject = (id) => {
    setForm((prev) => ({ ...prev, subjects: prev.subjects.includes(id) ? prev.subjects.filter((s) => s !== id) : [...prev.subjects, id] }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (editId) await facultyAPI.update(editId, form);
      else await facultyAPI.create(form);
      setAlert({ type: "success", message: `Faculty ${editId ? "updated" : "created"} successfully` });
      setModal(false); fetchData();
    } catch (err) { setAlert({ type: "error", message: err.response?.data?.message || "Save failed" }); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await facultyAPI.remove(deleteId);
      setAlert({ type: "success", message: "Faculty deleted" });
      setDeleteId(null); fetchData();
    } catch (err) { setAlert({ type: "error", message: err.response?.data?.message || "Delete failed" }); }
    finally { setDeleting(false); }
  };

  const paged = data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selectedSubjectNames = allSubjects.filter((s) => form.subjects.includes(s._id));

  return (
    <div>
      <div className="page-header">
        <h1>Faculty</h1>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Add Faculty</button>
      </div>
      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

      <div className="table-container">
        <div className="table-toolbar">
          <div className="search-bar"><Search size={15} color="var(--text-secondary)" /><input placeholder="Search faculty..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{data.length} record{data.length !== 1 ? "s" : ""}</span>
        </div>
        {loading ? <LoadingState /> : paged.length === 0 ? (
          <EmptyState title="No faculty found" message="Add your first faculty member." action={<button className="btn btn-primary" onClick={openAdd}><Plus size={14} /> Add Faculty</button>} />
        ) : (
          <>
            <table>
              <thead><tr><th>Name</th><th>Employee ID</th><th>Email</th><th>Department</th><th>Specialization</th><th>Max Hrs</th><th>Subjects</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {paged.map((f) => (
                  <tr key={f._id}>
                    <td style={{ fontWeight: 600 }}>{f.name}</td>
                    <td><span className="badge badge-cyan">{f.employeeId}</span></td>
                    <td style={{ fontSize: 12 }}>{f.email}</td>
                    <td>{f.department?.name || "—"}</td>
                    <td>{f.specialization || "—"}</td>
                    <td>{f.maxWeeklyHours}h</td>
                    <td>{f.subjects?.length > 0 ? <span className="badge badge-info">{f.subjects.length} subject{f.subjects.length !== 1 ? "s" : ""}</span> : "—"}</td>
                    <td><span className={`badge ${f.isActive ? "badge-success" : "badge-danger"}`}>{f.isActive ? "Active" : "Inactive"}</span></td>
                    <td><div className="table-actions">
                      <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(f)}><Pencil size={14} /></button>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeleteId(f._id)}><Trash2 size={14} /></button>
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
            <div className="modal-header"><h2>{editId ? "Edit Faculty" : "Add Faculty"}</h2><button className="icon-btn" onClick={() => setModal(false)}>✕</button></div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input className={errors.name ? "error" : ""} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Dr. Jane Smith" />
                    {errors.name && <div className="field-error">{errors.name}</div>}
                  </div>
                  <div className="form-group">
                    <label>Employee ID *</label>
                    <input className={errors.employeeId ? "error" : ""} value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} placeholder="e.g. EMP001" />
                    {errors.employeeId && <div className="field-error">{errors.employeeId}</div>}
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Email *</label>
                    <input type="email" className={errors.email ? "error" : ""} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="faculty@college.edu" />
                    {errors.email && <div className="field-error">{errors.email}</div>}
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
                    <label>Specialization</label>
                    <input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} placeholder="e.g. Machine Learning" />
                  </div>
                  <div className="form-group">
                    <label>Max Weekly Hours</label>
                    <input type="number" min={1} max={40} value={form.maxWeeklyHours} onChange={(e) => setForm({ ...form, maxWeeklyHours: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Subjects Can Teach</label>
                  <select onChange={(e) => { if (e.target.value) toggleSubject(e.target.value); e.target.value = ""; }}>
                    <option value="">— Select subject to add —</option>
                    {allSubjects.filter((s) => !form.subjects.includes(s._id)).map((s) => <option key={s._id} value={s._id}>{s.name} ({s.code})</option>)}
                  </select>
                  {selectedSubjectNames.length > 0 && (
                    <div className="chips-container">
                      {selectedSubjectNames.map((s) => (
                        <span key={s._id} className="chip">{s.name} <button type="button" onClick={() => toggleSubject(s._id)}><X size={12} /></button></span>
                      ))}
                    </div>
                  )}
                </div>
                {workingDays.length > 0 && (
                  <div className="form-group">
                    <label>Unavailable Days</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                      {workingDays.map((wd) => {
                        const isUnavail = !!form.availability[wd.dayName];
                        return (
                          <button
                            key={wd.dayName}
                            type="button"
                            onClick={() => toggleUnavailableDay(wd.dayName)}
                            className={`badge ${isUnavail ? "badge-danger" : "badge-success"}`}
                            style={{ cursor: "pointer", border: "none", padding: "4px 10px", fontSize: 12 }}
                          >
                            {wd.dayName.slice(0, 3)} {isUnavail ? "✕" : "✓"}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>Click a day to mark it as unavailable (red = unavailable)</div>
                  </div>
                )}
                <div className="form-check">
                  <input type="checkbox" id="facActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                  <label htmlFor="facActive">Active</label>
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
      <ConfirmDialog isOpen={!!deleteId} title="Delete Faculty" message="Delete this faculty member?" onConfirm={handleDelete} onCancel={() => setDeleteId(null)} loading={deleting} />
    </div>
  );
}
