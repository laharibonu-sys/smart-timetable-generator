import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { timeSlotsAPI } from "../services/api";
import { LoadingState, EmptyState } from "../components/States";
import ConfirmDialog from "../components/ConfirmDialog";
import Alert from "../components/Alert";
import Pagination from "../components/Pagination";

const PAGE_SIZE = 10;
const empty = { slotName: "", startTime: "", endTime: "", slotType: "Regular Class", isActive: true };
const typeColors = { "Regular Class": "badge-info", Lab: "badge-purple", Break: "badge-warning" };

export default function TimeSlots() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
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
      const res = await timeSlotsAPI.getAll();
      setData(res.data.data); setPage(1);
    } catch { setAlert({ type: "error", message: "Failed to load time slots" }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

  const validate = () => {
    const e = {};
    if (!form.slotName.trim()) e.slotName = "Slot name is required";
    if (!form.startTime) e.startTime = "Start time is required";
    if (!form.endTime) e.endTime = "End time is required";
    if (form.startTime && form.endTime && toMin(form.endTime) <= toMin(form.startTime)) e.endTime = "End time must be after start time";
    setErrors(e); return Object.keys(e).length === 0;
  };

  const openAdd = () => { setForm(empty); setEditId(null); setErrors({}); setModal(true); };
  const openEdit = (s) => { setForm({ slotName: s.slotName, startTime: s.startTime, endTime: s.endTime, slotType: s.slotType, isActive: s.isActive }); setEditId(s._id); setErrors({}); setModal(true); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (editId) await timeSlotsAPI.update(editId, form);
      else await timeSlotsAPI.create(form);
      setAlert({ type: "success", message: `Time slot ${editId ? "updated" : "created"} successfully` });
      setModal(false); fetchData();
    } catch (err) { setAlert({ type: "error", message: err.response?.data?.message || "Save failed" }); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await timeSlotsAPI.remove(deleteId);
      setAlert({ type: "success", message: "Time slot deleted" });
      setDeleteId(null); fetchData();
    } catch (err) { setAlert({ type: "error", message: err.response?.data?.message || "Delete failed" }); }
    finally { setDeleting(false); }
  };

  const paged = data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <div className="page-header">
        <h1>Time Slots</h1>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Add Time Slot</button>
      </div>
      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

      <div className="table-container">
        <div className="table-toolbar">
          <span style={{ fontSize: 13, fontWeight: 600 }}>All Time Slots</span>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{data.length} slot{data.length !== 1 ? "s" : ""}</span>
        </div>
        {loading ? <LoadingState /> : paged.length === 0 ? (
          <EmptyState title="No time slots configured" message="Add time slots for your timetable." action={<button className="btn btn-primary" onClick={openAdd}><Plus size={14} /> Add Time Slot</button>} />
        ) : (
          <>
            <table>
              <thead><tr><th>Slot Name</th><th>Start Time</th><th>End Time</th><th>Duration</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {paged.map((s) => {
                  const dur = s.startTime && s.endTime ? `${Math.floor((toMin(s.endTime) - toMin(s.startTime)) / 60)}h ${(toMin(s.endTime) - toMin(s.startTime)) % 60}m` : "—";
                  return (
                    <tr key={s._id}>
                      <td style={{ fontWeight: 600 }}>{s.slotName}</td>
                      <td>{s.startTime}</td>
                      <td>{s.endTime}</td>
                      <td>{dur}</td>
                      <td><span className={`badge ${typeColors[s.slotType] || "badge-info"}`}>{s.slotType}</span></td>
                      <td><span className={`badge ${s.isActive ? "badge-success" : "badge-danger"}`}>{s.isActive ? "Active" : "Inactive"}</span></td>
                      <td><div className="table-actions">
                        <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(s)}><Pencil size={14} /></button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeleteId(s._id)}><Trash2 size={14} /></button>
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination page={page} totalPages={Math.ceil(data.length / PAGE_SIZE)} total={data.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </div>

      {modal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header"><h2>{editId ? "Edit Time Slot" : "Add Time Slot"}</h2><button className="icon-btn" onClick={() => setModal(false)}>✕</button></div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Slot Name *</label>
                  <input className={errors.slotName ? "error" : ""} value={form.slotName} onChange={(e) => setForm({ ...form, slotName: e.target.value })} placeholder="e.g. Period 1" />
                  {errors.slotName && <div className="field-error">{errors.slotName}</div>}
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Start Time *</label>
                    <input type="time" className={errors.startTime ? "error" : ""} value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
                    {errors.startTime && <div className="field-error">{errors.startTime}</div>}
                  </div>
                  <div className="form-group">
                    <label>End Time *</label>
                    <input type="time" className={errors.endTime ? "error" : ""} value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
                    {errors.endTime && <div className="field-error">{errors.endTime}</div>}
                  </div>
                </div>
                <div className="form-group">
                  <label>Slot Type *</label>
                  <select value={form.slotType} onChange={(e) => setForm({ ...form, slotType: e.target.value })}>
                    <option>Regular Class</option><option>Lab</option><option>Break</option>
                  </select>
                </div>
                <div className="form-check">
                  <input type="checkbox" id="slotActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                  <label htmlFor="slotActive">Active</label>
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
      <ConfirmDialog isOpen={!!deleteId} title="Delete Time Slot" message="Delete this time slot?" onConfirm={handleDelete} onCancel={() => setDeleteId(null)} loading={deleting} />
    </div>
  );
}
