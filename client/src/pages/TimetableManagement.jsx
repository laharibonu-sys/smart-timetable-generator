import { useState, useEffect, useMemo } from "react";
import {
  LayoutList, CheckCircle, AlertTriangle, RefreshCw, Archive, Eye,
  Download, Printer, Trash2, BookOpen, Send, RotateCcw, History,
  ChevronDown, ChevronUp, XCircle, ShieldCheck, ShieldAlert, Edit2,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { timetablesAPI, departmentsAPI, sectionsAPI, facultyAPI, classroomsAPI, subjectsAPI, timeSlotsAPI, workingDaysAPI } from "../services/api";
import { LoadingState, EmptyState } from "../components/States";
import Alert from "../components/Alert";
import ConfirmDialog from "../components/ConfirmDialog";

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const STATUS_CLASS = { draft:"badge-warning", published:"badge-success", archived:"badge-info", failed:"badge-danger" };

function StatusBadge({ status }) {
  return <span className={`badge ${STATUS_CLASS[status] || "badge-info"}`}>{status}</span>;
}

function SummaryCard({ label, value, color }) {
  return (
    <div className="card" style={{ textAlign:"center", padding:"16px 12px" }}>
      <div style={{ fontSize:28, fontWeight:800, color: color || "var(--primary)" }}>{value}</div>
      <div style={{ fontSize:12, color:"var(--text-secondary)", marginTop:4 }}>{label}</div>
    </div>
  );
}

// ── PDF Export ────────────────────────────────────────────────────────────────
function exportPDF(tt) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const title = "Smart Timetable Generator";
  const dept  = tt.department?.name || "";
  const sec   = tt.section?.name   || "";

  doc.setFontSize(14); doc.setFont("helvetica","bold");
  doc.text(title, 148, 14, { align:"center" });
  doc.setFontSize(10); doc.setFont("helvetica","normal");
  doc.text(`Department: ${dept}   |   Section: ${sec}   |   Semester: ${tt.semester}   |   Year: ${tt.academicYear}   |   Status: ${tt.status}`, 148, 21, { align:"center" });
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 148, 27, { align:"center" });

  // Build grid: rows = time slots, cols = days
  const slotMap = {};
  tt.entries.forEach((e) => { if (e.timeSlot?._id) slotMap[String(e.timeSlot._id)] = e.timeSlot; });
  const slots = Object.values(slotMap).sort((a,b) => a.startTime.localeCompare(b.startTime));
  const days  = DAYS.filter((d) => tt.entries.some((e) => e.day === d));

  const head = [["Time Slot", ...days]];
  const body = slots.map((slot) => {
    const row = [`${slot.slotName}\n${slot.startTime}–${slot.endTime}`];
    days.forEach((day) => {
      const entries = tt.entries.filter((e) => e.day === day && String(e.timeSlot?._id) === String(slot._id));
      if (!entries.length) { row.push(""); return; }
      row.push(entries.map((e) =>
        `${e.subject?.name || ""} (${e.subject?.code || ""})\n${e.faculty?.name || ""}\n${e.classroom?.roomNumber || ""} · ${e.subject?.subjectType || ""}`
      ).join("\n---\n"));
    });
    return row;
  });

  autoTable(doc, {
    head, body, startY: 32,
    styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: [30, 27, 75], textColor: 255, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 22, fontStyle: "bold" } },
    didDrawPage: (data) => {
      doc.setFontSize(8);
      doc.text(`Page ${data.pageNumber}`, doc.internal.pageSize.width - 15, doc.internal.pageSize.height - 8);
    },
  });

  // Legend
  const finalY = doc.lastAutoTable.finalY + 6;
  doc.setFontSize(8);
  doc.text("Legend:  T = Theory   P = Practical   L = Lab", 14, finalY);

  const filename = `${dept}_Sem${tt.semester}_${sec}_Timetable.pdf`.replace(/\s+/g,"_");
  doc.save(filename);
}

// ── CSV Export (client-side fallback) ─────────────────────────────────────────
function exportCSVClient(tt) {
  const headers = ["TimetableID","Department","AcademicYear","Semester","Section","Day","StartTime","EndTime","SubjectCode","SubjectName","SubjectType","FacultyName","Classroom","Status"];
  const rows = tt.entries.map((e) => [
    tt._id, tt.department?.name||"", tt.academicYear, tt.semester, tt.section?.name||"",
    e.day, e.timeSlot?.startTime||"", e.timeSlot?.endTime||"",
    e.subject?.code||"", e.subject?.name||"", e.subject?.subjectType||"",
    e.faculty?.name||"", e.classroom?.roomNumber||"", tt.status,
  ]);
  const esc = (v) => `"${String(v).replace(/"/g,'""')}"`;
  const csv = [headers,...rows].map((r) => r.map(esc).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF"+csv], { type:"text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `${tt.department?.name||"Dept"}_Sem${tt.semester}_${tt.section?.name||"Section"}_Timetable.csv`.replace(/\s+/g,"_");
  a.click();
  URL.revokeObjectURL(url);
}

// ── Timetable Grid (read-only) ────────────────────────────────────────────────
function TimetableGrid({ tt }) {
  const slotMap = {};
  tt.entries.forEach((e) => { if (e.timeSlot?._id) slotMap[String(e.timeSlot._id)] = e.timeSlot; });
  const slots = Object.values(slotMap).sort((a,b) => a.startTime.localeCompare(b.startTime));
  const days  = DAYS.filter((d) => tt.entries.some((e) => e.day === d));
  const TYPE  = { Theory:"theory", Practical:"practical", Lab:"lab" };

  return (
    <div className="tt-grid-scroll" style={{ marginTop:12 }}>
      <table className="tt-grid">
        <thead>
          <tr>
            <th className="slot-col">Time Slot</th>
            {days.map((d) => <th key={d}>{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => (
            <tr key={slot._id}>
              <td className="slot-label">
                <div style={{ fontWeight:700 }}>{slot.slotName}</div>
                <div style={{ fontSize:11 }}>{slot.startTime}–{slot.endTime}</div>
              </td>
              {days.map((day) => {
                const entries = tt.entries.filter((e) => e.day===day && String(e.timeSlot?._id)===String(slot._id));
                return (
                  <td key={day}>
                    {entries.length===0 ? <div className="tt-cell-empty"/> : entries.map((e,i) => (
                      <div key={i} className={`tt-class-card ${TYPE[e.subject?.subjectType]||"theory"}`} style={{ marginBottom:4 }}>
                        <div className="cc-subject">{e.subject?.name}</div>
                        <div className="cc-code">{e.subject?.code} · {e.subject?.subjectType}</div>
                        <div className="cc-faculty">👤 {e.faculty?.name}</div>
                        <div className="cc-room">🏫 {e.classroom?.roomNumber}</div>
                        {e.isLabSession && <div style={{ fontSize:10, color:"#8b5cf6" }}>🔬 Lab</div>}
                      </div>
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Edit Assignment Modal ─────────────────────────────────────────────────────
function EditAssignmentModal({ timetableId, entry, onClose, onSaved, setAlert }) {
  const [form, setForm] = useState({
    subjectId:   String(entry.subject?._id   || entry.subject   || ""),
    facultyId:   String(entry.faculty?._id   || entry.faculty   || ""),
    classroomId: String(entry.classroom?._id || entry.classroom || ""),
    day:         entry.day || "",
    timeSlotId:  String(entry.timeSlot?._id  || entry.timeSlot  || ""),
  });
  const [subjects,   setSubjects]   = useState([]);
  const [facultyList,setFacultyList]= useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [timeSlots,  setTimeSlots]  = useState([]);
  const [saving,     setSaving]     = useState(false);
  const [conflicts,  setConflicts]  = useState([]);

  useEffect(() => {
    Promise.all([
      subjectsAPI.getAll(), facultyAPI.getAll(), classroomsAPI.getAll(),
      timeSlotsAPI.getAll(),
    ]).then(([s,f,c,ts]) => {
      setSubjects(s.data.data||[]);
      setFacultyList(f.data.data||[]);
      setClassrooms(c.data.data||[]);
      setTimeSlots((ts.data.data||[]).filter((t) => t.slotType !== "Break" && t.isActive));
    }).catch(()=>{});
  }, []);

  const handleSave = async () => {
    setSaving(true); setConflicts([]);
    try {
      await timetablesAPI.editAssignment(timetableId, entry._id, form);
      setAlert({ type:"success", message:"Assignment updated successfully." });
      onSaved();
      onClose();
    } catch (err) {
      const data = err.response?.data;
      if (data?.conflicts?.length) setConflicts(data.conflicts);
      setAlert({ type:"error", message: data?.message || "Update failed." });
    } finally { setSaving(false); }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div className="card" style={{ width:"100%", maxWidth:520, maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <h2 style={{ fontSize:15, fontWeight:700 }}>Edit Assignment</h2>
          <button className="btn btn-secondary btn-sm btn-icon" onClick={onClose}><XCircle size={14}/></button>
        </div>

        {conflicts.length > 0 && (
          <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:6, padding:10, marginBottom:12 }}>
            {conflicts.map((c,i) => <div key={i} style={{ fontSize:12, color:"#991b1b", marginBottom:4 }}>⚠ {c.message}</div>)}
          </div>
        )}

        <div className="form-group">
          <label>Subject</label>
          <select value={form.subjectId} onChange={(e) => setForm({...form, subjectId:e.target.value})}>
            <option value="">— Select —</option>
            {subjects.map((s) => <option key={s._id} value={s._id}>{s.name} ({s.code})</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Faculty</label>
          <select value={form.facultyId} onChange={(e) => setForm({...form, facultyId:e.target.value})}>
            <option value="">— Select —</option>
            {facultyList.map((f) => <option key={f._id} value={f._id}>{f.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Classroom</label>
          <select value={form.classroomId} onChange={(e) => setForm({...form, classroomId:e.target.value})}>
            <option value="">— Select —</option>
            {classrooms.map((c) => <option key={c._id} value={c._id}>{c.roomNumber} ({c.roomType})</option>)}
          </select>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Day</label>
            <select value={form.day} onChange={(e) => setForm({...form, day:e.target.value})}>
              {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Time Slot</label>
            <select value={form.timeSlotId} onChange={(e) => setForm({...form, timeSlotId:e.target.value})}>
              <option value="">— Select —</option>
              {timeSlots.map((t) => <option key={t._id} value={t._id}>{t.slotName} ({t.startTime}–{t.endTime})</option>)}
            </select>
          </div>
        </div>

        <div style={{ display:"flex", gap:8, marginTop:8 }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Audit Log Panel ───────────────────────────────────────────────────────────
function AuditPanel({ timetableId, onClose }) {
  const [logs, setLogs]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    timetablesAPI.getAuditLog(timetableId)
      .then((r) => setLogs(r.data.data||[]))
      .catch(()=>{})
      .finally(()=>setLoading(false));
  }, [timetableId]);

  const ACTION_ICON = {
    generated:"⚡", validated:"✅", published:"🚀", archived:"📦",
    restored:"♻️", regenerated:"🔄", assignment_edited:"✏️", deleted:"🗑️",
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div className="card" style={{ width:"100%", maxWidth:560, maxHeight:"80vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <h2 style={{ fontSize:15, fontWeight:700 }}>Audit History</h2>
          <button className="btn btn-secondary btn-sm btn-icon" onClick={onClose}><XCircle size={14}/></button>
        </div>
        {loading ? <LoadingState/> : logs.length===0 ? <EmptyState title="No history yet"/> : (
          <div>
            {logs.map((l) => (
              <div key={l._id} style={{ borderLeft:"3px solid var(--primary)", paddingLeft:12, marginBottom:12 }}>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <span style={{ fontSize:16 }}>{ACTION_ICON[l.action]||"•"}</span>
                  <span style={{ fontWeight:700, fontSize:13, textTransform:"capitalize" }}>{l.action.replace(/_/g," ")}</span>
                  <span style={{ fontSize:11, color:"var(--text-secondary)", marginLeft:"auto" }}>
                    {new Date(l.createdAt).toLocaleString()}
                  </span>
                </div>
                <div style={{ fontSize:12, color:"var(--text-secondary)", marginTop:2 }}>
                  by {l.performedBy?.name || "Unknown"}
                  {l.note ? ` · ${l.note}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Detail Panel ──────────────────────────────────────────────────────────────
function DetailPanel({ tt, onClose, onAction, setAlert }) {
  const [validResult, setValidResult] = useState(null);
  const [validating,  setValidating]  = useState(false);
  const [editEntry,   setEditEntry]   = useState(null);
  const [showAudit,   setShowAudit]   = useState(false);
  const [showGrid,    setShowGrid]    = useState(true);

  const handleValidate = async () => {
    setValidating(true); setValidResult(null);
    try {
      const r = await timetablesAPI.validate(tt._id);
      setValidResult(r.data);
      setAlert({ type: r.data.valid?"success":"error", message: r.data.message });
    } catch (err) {
      setAlert({ type:"error", message: err.response?.data?.message||"Validation failed." });
    } finally { setValidating(false); }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:150, overflowY:"auto", padding:16 }}>
      <div className="card" style={{ maxWidth:1100, margin:"0 auto" }}>
        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16, flexWrap:"wrap", gap:8 }}>
          <div>
            <h2 style={{ fontSize:16, fontWeight:800 }}>
              {tt.section?.name} — {tt.department?.name} · Sem {tt.semester} · {tt.academicYear}
              <StatusBadge status={tt.status}/>
            </h2>
            <p style={{ fontSize:12, color:"var(--text-secondary)", marginTop:4 }}>
              Created by {tt.createdBy?.name||"—"} on {new Date(tt.createdAt).toLocaleDateString()}
              {tt.publishedAt && ` · Published ${new Date(tt.publishedAt).toLocaleDateString()}`}
              {tt.archivedAt  && ` · Archived ${new Date(tt.archivedAt).toLocaleDateString()}`}
            </p>
          </div>
          <button className="btn btn-secondary btn-sm btn-icon" onClick={onClose}><XCircle size={14}/></button>
        </div>

        {/* Stats row */}
        <div style={{ display:"flex", gap:16, flexWrap:"wrap", marginBottom:16 }}>
          <div className="tt-stat"><span className="ts-value" style={{ color:"var(--primary)" }}>{tt.statistics?.scheduledTasks}</span><span className="ts-label">/ {tt.statistics?.requiredTasks} Scheduled</span></div>
          <div className="tt-stat"><span className="ts-value" style={{ color: tt.statistics?.unscheduledTasks>0?"var(--danger)":"var(--success)" }}>{tt.statistics?.unscheduledTasks}</span><span className="ts-label">Unscheduled</span></div>
          <div className="tt-stat"><span className="ts-value">{tt.statistics?.qualityScore}%</span><span className="ts-label">Quality</span></div>
          <div className="tt-stat"><span className="ts-value">{tt.entries?.length}</span><span className="ts-label">Classes/week</span></div>
          {tt.validationSummary?.checkedAt && (
            <div className="tt-stat">
              <span className="ts-value" style={{ color: tt.validationSummary.valid?"var(--success)":"var(--danger)" }}>
                {tt.validationSummary.valid?"✓ Valid":"✗ Invalid"}
              </span>
              <span className="ts-label">Last validated</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
          <button className="btn btn-secondary btn-sm" onClick={handleValidate} disabled={validating}>
            <CheckCircle size={13}/> {validating?"Validating...":"Validate"}
          </button>
          {tt.status==="draft" && (
            <button className="btn btn-success btn-sm" onClick={() => onAction("publish", tt._id)}>
              <Send size={13}/> Publish
            </button>
          )}
          {tt.status!=="archived" && (
            <button className="btn btn-secondary btn-sm" onClick={() => onAction("archive", tt._id)}>
              <Archive size={13}/> Archive
            </button>
          )}
          {tt.status==="archived" && (
            <button className="btn btn-secondary btn-sm" onClick={() => onAction("restore", tt._id)}>
              <RotateCcw size={13}/> Restore
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => onAction("regenerate", tt._id)}>
            <RefreshCw size={13}/> Regenerate
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => exportPDF(tt)}>
            <Download size={13}/> PDF
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => exportCSVClient(tt)}>
            <Download size={13}/> CSV
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>
            <Printer size={13}/> Print
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowAudit(true)}>
            <History size={13}/> History
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowGrid(!showGrid)}>
            {showGrid ? <ChevronUp size={13}/> : <ChevronDown size={13}/>} {showGrid?"Hide Grid":"Show Grid"}
          </button>
        </div>

        {/* Validation result */}
        {validResult && (
          <div style={{ background: validResult.valid?"#ecfdf5":"#fef2f2", border:`1px solid ${validResult.valid?"#a7f3d0":"#fecaca"}`, borderRadius:6, padding:12, marginBottom:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, fontWeight:700, fontSize:13 }}>
              {validResult.valid ? <ShieldCheck size={14} color="var(--success)"/> : <ShieldAlert size={14} color="var(--danger)"/>}
              {validResult.message}
            </div>
            {validResult.conflicts?.slice(0,5).map((c,i) => (
              <div key={i} style={{ fontSize:12, marginTop:6, color: c.severity==="error"?"#991b1b":"#92400e" }}>
                {c.severity==="error"?"⚠":"ℹ"} {c.message}
              </div>
            ))}
            {validResult.conflicts?.length>5 && <div style={{ fontSize:11, color:"var(--text-secondary)", marginTop:4 }}>+{validResult.conflicts.length-5} more…</div>}
          </div>
        )}

        {/* Timetable grid */}
        {showGrid && tt.entries?.length>0 && (
          <div className="tt-grid-wrapper" style={{ marginBottom:16 }}>
            <div className="print-only-header">
              Smart Timetable Generator — {tt.department?.name} · {tt.section?.name} · Sem {tt.semester} · {tt.academicYear}
            </div>
            <TimetableGrid tt={tt}/>
          </div>
        )}

        {/* Assignments list with edit */}
        {tt.status==="draft" && (
          <div>
            <h3 style={{ fontSize:13, fontWeight:700, marginBottom:8 }}>Assignments <span style={{ fontSize:11, color:"var(--text-secondary)" }}>(click Edit to modify)</span></h3>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead>
                  <tr style={{ background:"var(--bg)" }}>
                    {["Day","Time","Subject","Faculty","Room","Type",""].map((h) => (
                      <th key={h} style={{ padding:"6px 10px", textAlign:"left", borderBottom:"1px solid var(--border)", fontWeight:600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tt.entries.map((e) => (
                    <tr key={e._id} style={{ borderBottom:"1px solid var(--border)" }}>
                      <td style={{ padding:"6px 10px" }}>{e.day}</td>
                      <td style={{ padding:"6px 10px", whiteSpace:"nowrap" }}>{e.timeSlot?.startTime}–{e.timeSlot?.endTime}</td>
                      <td style={{ padding:"6px 10px" }}>{e.subject?.name} <span style={{ color:"var(--text-secondary)" }}>({e.subject?.code})</span></td>
                      <td style={{ padding:"6px 10px" }}>{e.faculty?.name}</td>
                      <td style={{ padding:"6px 10px" }}>{e.classroom?.roomNumber}</td>
                      <td style={{ padding:"6px 10px" }}>{e.subject?.subjectType}</td>
                      <td style={{ padding:"6px 10px" }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditEntry(e)}>
                          <Edit2 size={11}/> Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {editEntry && (
        <EditAssignmentModal
          timetableId={tt._id} entry={editEntry}
          onClose={() => setEditEntry(null)}
          onSaved={() => { onAction("refresh", tt._id); setEditEntry(null); }}
          setAlert={setAlert}
        />
      )}
      {showAudit && <AuditPanel timetableId={tt._id} onClose={() => setShowAudit(false)}/>}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TimetableManagement() {
  const [timetables, setTimetables] = useState([]);
  const [counts,     setCounts]     = useState({ total:0, draft:0, published:0, archived:0, failed:0, totalEntries:0 });
  const [loading,    setLoading]    = useState(true);
  const [alert,      setAlert]      = useState(null);
  const [search,     setSearch]     = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDept,   setFilterDept]   = useState("");
  const [departments,  setDepartments]  = useState([]);
  const [detailTT,     setDetailTT]     = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // { type, id, label }
  const [actionLoading, setActionLoading] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (filterDept)   params.department = filterDept;
      const r = await timetablesAPI.getAll(params);
      setTimetables(r.data.data||[]);
      setCounts(r.data.counts||{});
    } catch { setTimetables([]); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    departmentsAPI.getAll().then((r) => setDepartments(r.data.data||[])).catch(()=>{});
  }, []);

  useEffect(() => { fetchAll(); }, [filterStatus, filterDept]);

  const filtered = useMemo(() =>
    timetables.filter((tt) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        tt.section?.name?.toLowerCase().includes(q) ||
        tt.department?.name?.toLowerCase().includes(q) ||
        tt.academicYear?.toLowerCase().includes(q) ||
        tt.createdBy?.name?.toLowerCase().includes(q)
      );
    }), [timetables, search]);

  const handleAction = async (type, id) => {
    if (type === "refresh") {
      // Reload detail
      try {
        const r = await timetablesAPI.getOne(id);
        setDetailTT(r.data.data);
      } catch {}
      fetchAll();
      return;
    }
    if (type === "view") {
      try {
        const r = await timetablesAPI.getOne(id);
        setDetailTT(r.data.data);
      } catch (err) {
        setAlert({ type:"error", message: err.response?.data?.message||"Failed to load." });
      }
      return;
    }
    // Actions that need confirmation
    const labels = { publish:"Publish", archive:"Archive", restore:"Restore", regenerate:"Regenerate", delete:"Delete" };
    setConfirmAction({ type, id, label: labels[type]||type });
  };

  const executeAction = async () => {
    if (!confirmAction) return;
    const { type, id } = confirmAction;
    setActionLoading(true);
    try {
      let msg = "";
      if (type==="publish")    { const r = await timetablesAPI.publish(id);    msg = r.data.message; }
      if (type==="archive")    { const r = await timetablesAPI.archive(id);    msg = r.data.message; }
      if (type==="restore")    { const r = await timetablesAPI.restore(id);    msg = r.data.message; }
      if (type==="regenerate") { const r = await timetablesAPI.regenerate(id); msg = r.data.message; }
      if (type==="delete")     { const r = await timetablesAPI.remove(id);     msg = r.data.message; }
      setAlert({ type:"success", message: msg });
      setConfirmAction(null);
      // Refresh detail if open
      if (detailTT?._id === id && type !== "delete") {
        const r = await timetablesAPI.getOne(id);
        setDetailTT(r.data.data);
      } else if (type==="delete") {
        setDetailTT(null);
      }
      fetchAll();
    } catch (err) {
      setAlert({ type:"error", message: err.response?.data?.message||`${type} failed.` });
      setConfirmAction(null);
    } finally { setActionLoading(false); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Timetable Management</h1>
          <p style={{ fontSize:13, color:"var(--text-secondary)", marginTop:2 }}>
            Save, view, edit, publish, archive, and export timetables
          </p>
        </div>
      </div>

      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)}/>}

      {/* Summary cards */}
      <div className="summary-grid" style={{ marginBottom:20 }}>
        <SummaryCard label="Total Timetables"    value={counts.total}       color="var(--primary)"/>
        <SummaryCard label="Drafts"              value={counts.draft}       color="var(--warning)"/>
        <SummaryCard label="Published"           value={counts.published}   color="var(--success)"/>
        <SummaryCard label="Archived"            value={counts.archived}    color="var(--info)"/>
        <SummaryCard label="Total Classes"       value={counts.totalEntries} color="#8b5cf6"/>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom:16, display:"flex", gap:12, flexWrap:"wrap", alignItems:"flex-end" }}>
        <div className="form-group" style={{ marginBottom:0, flex:"1 1 200px" }}>
          <label>Search</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Section, department, year, creator…"/>
        </div>
        <div className="form-group" style={{ marginBottom:0 }}>
          <label>Status</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <div className="form-group" style={{ marginBottom:0 }}>
          <label>Department</label>
          <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
            <option value="">All Departments</option>
            {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
        </div>
        <button className="btn btn-secondary" onClick={() => { setSearch(""); setFilterStatus(""); setFilterDept(""); }}>
          Clear
        </button>
      </div>

      {/* Timetable list */}
      {loading ? <LoadingState message="Loading timetables…"/> : filtered.length===0 ? (
        <EmptyState title="No timetables found" message="Generate a timetable from the Generate Timetable page."/>
      ) : (
        <div>
          {filtered.map((tt) => (
            <div key={tt._id} className="tt-list-item">
              <div className="tt-list-info" style={{ flex:1 }}>
                <h3 style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                  {tt.section?.name} — Sem {tt.semester} ({tt.academicYear})
                  <StatusBadge status={tt.status}/>
                  {tt.validationSummary?.checkedAt && (
                    <span style={{ fontSize:10, color: tt.validationSummary.valid?"var(--success)":"var(--danger)" }}>
                      {tt.validationSummary.valid?"✓ Valid":"✗ Invalid"}
                    </span>
                  )}
                </h3>
                <p style={{ fontSize:12, color:"var(--text-secondary)", marginTop:3 }}>
                  {tt.department?.name} · {tt.statistics?.scheduledTasks}/{tt.statistics?.requiredTasks} scheduled
                  · Quality {tt.statistics?.qualityScore}%
                  · {new Date(tt.createdAt).toLocaleDateString()}
                  · by {tt.createdBy?.name||"—"}
                </p>
              </div>
              <div className="tt-list-actions" style={{ flexWrap:"wrap" }}>
                <button className="btn btn-secondary btn-sm" onClick={() => handleAction("view", tt._id)}>
                  <Eye size={12}/> View
                </button>
                {tt.status==="draft" && (
                  <button className="btn btn-success btn-sm" onClick={() => handleAction("publish", tt._id)}>
                    <Send size={12}/> Publish
                  </button>
                )}
                {tt.status!=="archived" && (
                  <button className="btn btn-secondary btn-sm" onClick={() => handleAction("archive", tt._id)}>
                    <Archive size={12}/> Archive
                  </button>
                )}
                {tt.status==="archived" && (
                  <button className="btn btn-secondary btn-sm" onClick={() => handleAction("restore", tt._id)}>
                    <RotateCcw size={12}/> Restore
                  </button>
                )}
                <button className="btn btn-secondary btn-sm" onClick={() => handleAction("regenerate", tt._id)}>
                  <RefreshCw size={12}/> Regen
                </button>
                <button className="btn btn-secondary btn-sm" onClick={async () => {
                  try { const r = await timetablesAPI.getOne(tt._id); exportPDF(r.data.data); }
                  catch { setAlert({ type:"error", message:"PDF export failed." }); }
                }}>
                  <Download size={12}/> PDF
                </button>
                <button className="btn btn-secondary btn-sm" onClick={async () => {
                  try { const r = await timetablesAPI.getOne(tt._id); exportCSVClient(r.data.data); }
                  catch { setAlert({ type:"error", message:"CSV export failed." }); }
                }}>
                  <Download size={12}/> CSV
                </button>
                {tt.status!=="published" && (
                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleAction("delete", tt._id)} title="Delete">
                    <Trash2 size={12}/>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail panel */}
      {detailTT && (
        <DetailPanel
          tt={detailTT}
          onClose={() => setDetailTT(null)}
          onAction={handleAction}
          setAlert={setAlert}
        />
      )}

      {/* Confirm dialog */}
      <ConfirmDialog
        isOpen={!!confirmAction}
        title={`${confirmAction?.label} Timetable`}
        message={
          confirmAction?.type==="delete"
            ? "Delete this timetable? This cannot be undone."
            : confirmAction?.type==="publish"
            ? "Publish this timetable? It will become visible to faculty and students."
            : confirmAction?.type==="archive"
            ? "Archive this timetable? It will be hidden from active views."
            : confirmAction?.type==="restore"
            ? "Restore this timetable to draft status?"
            : "Regenerate this timetable? A new draft will be created."
        }
        onConfirm={executeAction}
        onCancel={() => setConfirmAction(null)}
        loading={actionLoading}
      />
    </div>
  );
}
