import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { classroomsAPI } from "../services/api";
import { LoadingState, EmptyState } from "../components/States";
import ConfirmDialog from "../components/ConfirmDialog";
import Alert from "../components/Alert";
import Pagination from "../components/Pagination";

const PAGE_SIZE = 10;
const empty = { roomNumber: "", building: "", roomType: "Classroom", capacity: "", equipment: "", isAvailable: true };
const typeColors = { Classroom: "badge-info", "Computer Lab": "badge-purple", "Science Lab": "badge-warning", Other: "badge-cyan" };

export default function Classrooms() {
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
      const res = await classroomsAPI.getAll({ search });
      setData(res.data.data); setPage(1);
    } catch { setAlert({ type: "error", message: "Failed to load classrooms" }); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const validate = () => {
    const e = {};
    if (!form.roomNumber.trim()) e.roomNumber = "Room number is required";
    if (!form.capacity || form.capacity < 1) e.capacity = "Capacity must be at least 1";
    setErrors(e); return Object.keys(e).length === 0;
  };

  const openAdd = () => { setForm(empty); setEditId(null); setErrors({}); setModal(true); };
  const openEdit = (r) => {
    setForm({ roomNumber: r.roomNumber, building: r.building || "", roomType: r.roomType, capacity: r.capacity, equipment: Array.isArray(r.equipment) ? r.equipment.join(", ") : r.equipment || "", isAvailable: r.isAvailable });
    setEditId(r._id); setErrors({}); setModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (editId) await classroomsAPI.update(editId, form);
      else await classroomsAPI.create(form);
      setAlert({ type: "success", message: `Classroom ${editId ? "updated" : "created"} successfully` });
      setModal(false); fetchData();
    } catch (err) { setAlert({ type: "error", message: err.response?.data?.message || "Save failed" }); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await classroomsAPI.remove(deleteId);
      setAlert({ type: "success", message: "Classroom deleted" });
      setDeleteId(null); fetchData();
    } catch (err) { setAlert({ type: "error", message: err.response?.data?.message || "Delete failed" }); }
    finally { setDeleting(false); }
  };

  const paged = data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <div className="page-header">
        <h1>Classrooms & Labs</h1>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Add Room</button>
      </div>
      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

      <div className="table-container">
        <div className="table-toolbar">
          <div className="search-bar"><Search size={15} color="var(--text-secondary)" /><input placeholder="Search rooms..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{data.length} record{data.length !== 1 ? "s" : ""}</span>
        </div>
        {loading ? <LoadingState /> : paged.length === 0 ? (
          <EmptyState title="No rooms found" message="Add your first classroom or lab." action={<button className="btn btn-primary" onClick={openAdd}><Plus size={14} /> Add Room</button>} />
        ) : (
          <>
            <table>
              <thead><tr><th>Room No.</th><th>Building</th><th>Type</th><th>Capacity</th><th>Equipment</th><th>Availability</th><th>Actions</th></tr></thead>
              <tbody>
                {paged.map((r) => (
                  <tr key={r._id}>
                    <td style={{ fontWeight: 600 }}>{r.roomNumber}</td>
                    <td>{r.building || "—"}</td>
                    <td><span className={`badge ${typeColors[r.roomType] || "badge-info"}`}>{r.roomType}</span></td>
                    <td>{r.capacity}</td>
                    <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{Array.isArray(r.equipment) ? r.equipment.join(", ") || "—" : r.equipment || "—"}</td>
                    <td><span className={`badge ${r.isAvailable ? "badge-success" : "badge-danger"}`}>{r.isAvailable ? "Available" : "Unavailable"}</span></td>
                    <td><div className="table-actions">
                      <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(r)}><Pencil size={14} /></button>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeleteId(r._id)}><Trash2 size={14} /></button>
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
            <div className="modal-header"><h2>{editId ? "Edit Room" : "Add Room"}</h2><button className="icon-btn" onClick={() => setModal(false)}>✕</button></div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Room Number *</label>
                    <input className={errors.roomNumber ? "error" : ""} value={form.roomNumber} onChange={(e) => setForm({ ...form, roomNumber: e.target.value })} placeholder="e.g. A101" />
                    {errors.roomNumber && <div className="field-error">{errors.roomNumber}</div>}
                  </div>
                  <div className="form-group">
                    <label>Building</label>
                    <input value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })} placeholder="e.g. Main Block" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Room Type *</label>
                    <select value={form.roomType} onChange={(e) => setForm({ ...form, roomType: e.target.value })}>
                      <option>Classroom</option><option>Computer Lab</option><option>Science Lab</option><option>Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Capacity *</label>
                    <input type="number" min={1} className={errors.capacity ? "error" : ""} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="e.g. 60" />
                    {errors.capacity && <div className="field-error">{errors.capacity}</div>}
                  </div>
                </div>
                <div className="form-group">
                  <label>Equipment (comma-separated)</label>
                  <input value={form.equipment} onChange={(e) => setForm({ ...form, equipment: e.target.value })} placeholder="e.g. Projector, Whiteboard, AC" />
                </div>
                <div className="form-check">
                  <input type="checkbox" id="roomAvail" checked={form.isAvailable} onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })} />
                  <label htmlFor="roomAvail">Available</label>
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
      <ConfirmDialog isOpen={!!deleteId} title="Delete Room" message="Delete this classroom/lab?" onConfirm={handleDelete} onCancel={() => setDeleteId(null)} loading={deleting} />
    </div>
  );
}
