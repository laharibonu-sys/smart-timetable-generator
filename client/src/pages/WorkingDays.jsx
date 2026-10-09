import { useState, useEffect } from "react";
import { Plus, Trash2, Save } from "lucide-react";
import { workingDaysAPI } from "../services/api";
import { LoadingState, EmptyState } from "../components/States";
import ConfirmDialog from "../components/ConfirmDialog";
import Alert from "../components/Alert";

const DEFAULT_DAYS = [
  { dayName: "Monday", isWorkingDay: true, displayOrder: 1 },
  { dayName: "Tuesday", isWorkingDay: true, displayOrder: 2 },
  { dayName: "Wednesday", isWorkingDay: true, displayOrder: 3 },
  { dayName: "Thursday", isWorkingDay: true, displayOrder: 4 },
  { dayName: "Friday", isWorkingDay: true, displayOrder: 5 },
  { dayName: "Saturday", isWorkingDay: false, displayOrder: 6 },
  { dayName: "Sunday", isWorkingDay: false, displayOrder: 7 },
];

export default function WorkingDays() {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [alert, setAlert] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await workingDaysAPI.getAll();
      setDays(res.data.data);
    } catch { setAlert({ type: "error", message: "Failed to load working days" }); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const toggle = (id) => setDays((prev) => prev.map((d) => d._id === id ? { ...d, isWorkingDay: !d.isWorkingDay } : d));

  const handleSave = async () => {
    setSaving(true);
    try {
      await workingDaysAPI.bulkUpdate(days.map((d) => ({ _id: d._id, isWorkingDay: d.isWorkingDay })));
      setAlert({ type: "success", message: "Working days saved successfully" });
      fetchData();
    } catch (err) { setAlert({ type: "error", message: err.response?.data?.message || "Save failed" }); }
    finally { setSaving(false); }
  };

  const seedDefaults = async () => {
    setSeeding(true);
    try {
      await Promise.all(DEFAULT_DAYS.map((d) => workingDaysAPI.create(d)));
      setAlert({ type: "success", message: "Default working days created" });
      fetchData();
    } catch (err) { setAlert({ type: "error", message: err.response?.data?.message || "Some days may already exist" }); fetchData(); }
    finally { setSeeding(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await workingDaysAPI.remove(deleteId);
      setAlert({ type: "success", message: "Day deleted" });
      setDeleteId(null); fetchData();
    } catch (err) { setAlert({ type: "error", message: err.response?.data?.message || "Delete failed" }); }
    finally { setDeleting(false); }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Working Days</h1>
        <div style={{ display: "flex", gap: 10 }}>
          {days.length === 0 && <button className="btn btn-secondary" onClick={seedDefaults} disabled={seeding}><Plus size={16} />{seeding ? "Creating..." : "Add Default Days"}</button>}
          {days.length > 0 && <button className="btn btn-primary" onClick={handleSave} disabled={saving}><Save size={16} />{saving ? "Saving..." : "Save Changes"}</button>}
        </div>
      </div>
      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

      {loading ? <LoadingState /> : days.length === 0 ? (
        <EmptyState title="No working days configured" message='Click "Add Default Days" to set up Monday–Sunday.' action={<button className="btn btn-primary" onClick={seedDefaults} disabled={seeding}><Plus size={14} />{seeding ? "Creating..." : "Add Default Days"}</button>} />
      ) : (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Toggle which days are working days, then click <strong>Save Changes</strong>.</p>
          </div>
          <div className="days-grid">
            {days.map((day) => (
              <div key={day._id} className={`day-card ${day.isWorkingDay ? "working" : ""}`}>
                <div>
                  <div className="day-name">{day.dayName}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{day.isWorkingDay ? "Working Day" : "Holiday"}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <label className="toggle-switch">
                    <input type="checkbox" checked={day.isWorkingDay} onChange={() => toggle(day._id)} />
                    <span className="toggle-slider" />
                  </label>
                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeleteId(day._id)} title="Delete"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      <ConfirmDialog isOpen={!!deleteId} title="Delete Day" message="Remove this day from the schedule?" onConfirm={handleDelete} onCancel={() => setDeleteId(null)} loading={deleting} />
    </div>
  );
}
