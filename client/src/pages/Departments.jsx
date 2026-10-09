import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Search, GraduationCap } from "lucide-react";
import { departmentsAPI } from "../services/api";
import { LoadingState, EmptyState } from "../components/States";
import ConfirmDialog from "../components/ConfirmDialog";
import Alert from "../components/Alert";
import Pagination from "../components/Pagination";

const PAGE_SIZE = 10;
const empty = { name: "", code: "", description: "", hodName: "", isActive: true };

export default function Departments() {
  const [data, setData] = useState([]);
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
      const res = await departmentsAPI.getAll({ search });
      setData(res.data.data);
      setPage(1);
    } catch { setAlert({ type: "error", message: "Failed to load departments" }); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.code.trim()) e.code = "Code is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const openAdd = () => { setForm(empty); setEditId(null); setErrors({}); setModal(true); };
  const openEdit = (dept) => { setForm({ name: dept.name, code: dept.code, description: dept.description || "", hodName: dept.hodName || "", isActive: dept.isActive }); setEditId(dept._id); setErrors({}); setModal(true); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (editId) await departmentsAPI.update(editId, form);
      else await departmentsAPI.create(form);
      setAlert({ type: "success", message: `Department ${editId ? "updated" : "created"} successfully` });
      setModal(false);
      fetchData();
    } catch (err) {
      setAlert({ type: "error", message: err.response?.data?.message || "Save failed" });
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await departmentsAPI.remove(deleteId);
      setAlert({ type: "success", message: "Department deleted" });
      setDeleteId(null);
      fetchData();
    } catch (err) {
      setAlert({ type: "error", message: err.response?.data?.message || "Delete failed" });
    } finally { setDeleting(false); }
  };

  const paged = data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <div className="page-header">
        <h1>Departments</h1>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Add Department</button>
      </div>

      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

      <div className="table-container">
        <div className="table-toolbar">
          <div className="search-bar">
            <Search size={15} color="var(--text-secondary)" />
            <input placeholder="Search departments..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{data.length} record{data.length !== 1 ? "s" : ""}</span>
        </div>

        {loading ? <LoadingState /> : paged.length === 0 ? (
          <EmptyState title="No departments found" message="Add your first department to get started." action={<button className="btn btn-primary" onClick={openAdd}><Plus size={14} /> Add Department</button>} />
        ) : (
          <>
            <table>
              <thead><tr><th>Name</th><th>Code</th><th>HoD</th><th>Description</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {paged.map((d) => (
                  <tr key={d._id}>
                    <td style={{ fontWeight: 600 }}>{d.name}</td>
                    <td><span className="badge badge-purple">{d.code}</span></td>
                    <td>{d.hodName || <span style={{ color: "var(--text-secondary)" }}>—</span>}</td>
                    <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.description || "—"}</td>
                    <td><span className={`badge ${d.isActive ? "badge-success" : "badge-danger"}`}>{d.isActive ? "Active" : "Inactive"}</span></td>
                    <td>
                      <div className="table-actions">
                        <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(d)} title="Edit"><Pencil size={14} /></button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeleteId(d._id)} title="Delete"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} totalPages={Math.ceil(data.length / PAGE_SIZE)} total={data.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>{editId ? "Edit Department" : "Add Department"}</h2>
              <button className="icon-btn" onClick={() => setModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Department Name *</label>
                    <input className={errors.name ? "error" : ""} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Computer Science" />
                    {errors.name && <div className="field-error">{errors.name}</div>}
                  </div>
                  <div className="form-group">
                    <label>Department Code *</label>
                    <input className={errors.code ? "error" : ""} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="e.g. CS" />
                    {errors.code && <div className="field-error">{errors.code}</div>}
                  </div>
                </div>
                <div className="form-group">
                  <label>Head of Department</label>
                  <input value={form.hodName} onChange={(e) => setForm({ ...form, hodName: e.target.value })} placeholder="e.g. Dr. John Smith" />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description..." />
                </div>
                <div className="form-check">
                  <input type="checkbox" id="deptActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                  <label htmlFor="deptActive">Active</label>
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

      <ConfirmDialog isOpen={!!deleteId} title="Delete Department" message="Are you sure you want to delete this department? This may affect related subjects, faculty, and sections." onConfirm={handleDelete} onCancel={() => setDeleteId(null)} loading={deleting} />
    </div>
  );
}
