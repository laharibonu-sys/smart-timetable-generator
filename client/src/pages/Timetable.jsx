import { useState, useEffect } from "react";
import {
  Zap, CheckCircle, AlertTriangle, RefreshCw, Printer, Eye, Trash2,
  ChevronDown, ChevronUp, XCircle, ShieldCheck, ShieldAlert,
} from "lucide-react";
import { timetablesAPI, departmentsAPI, sectionsAPI } from "../services/api";
import { LoadingState, EmptyState } from "../components/States";
import Alert from "../components/Alert";
import ConfirmDialog from "../components/ConfirmDialog";

const DAYS_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const CONFLICT_LABELS = {
  FACULTY_CONFLICT:          "Faculty Clash",
  ROOM_CONFLICT:             "Room Clash",
  SECTION_CONFLICT:          "Section Clash",
  DUPLICATE_ALLOCATION:      "Duplicate Entry",
  INVALID_FACULTY:           "Invalid Faculty",
  INACTIVE_FACULTY:          "Inactive Faculty",
  FACULTY_NOT_ELIGIBLE:      "Faculty Not Eligible",
  INVALID_ROOM:              "Invalid Room",
  ROOM_UNAVAILABLE:          "Room Unavailable",
  ROOM_TYPE_MISMATCH:        "Wrong Room Type",
  ROOM_CAPACITY:             "Room Too Small",
  INVALID_WORKING_DAY:       "Non-Working Day",
  INVALID_TIME_SLOT:         "Invalid Slot",
  INACTIVE_TIME_SLOT:        "Inactive Slot",
  CLASS_DURING_BREAK:        "Class in Break",
  INSUFFICIENT_WEEKLY_HOURS: "Under-Scheduled",
  EXCESS_WEEKLY_HOURS:       "Over-Scheduled",
  LAB_MISSING_CONSECUTIVE_SLOT:  "Lab: Missing Slot",
  LAB_INVALID_CONSECUTIVE_SLOT:  "Lab: Invalid Slot",
  LAB_NON_CONSECUTIVE_SLOTS:     "Lab: Non-Consecutive",
  FACULTY_OVERLOADED:        "Faculty Overloaded",
};

// ── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = { draft: "badge-warning", published: "badge-success", failed: "badge-danger" };
  return <span className={`badge ${map[status] || "badge-info"}`}>{status}</span>;
}

// ── Quality Score ─────────────────────────────────────────────────────────────
function QualityScore({ score }) {
  const cls = score >= 80 ? "high" : score >= 50 ? "mid" : "low";
  return (
    <div className="quality-ring">
      <span className={`quality-score ${cls}`}>{score}%</span>
      <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>quality</span>
    </div>
  );
}

// ── Readiness Panel ───────────────────────────────────────────────────────────
function ReadinessPanel({ sectionId, semester }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sectionId || !semester) { setData(null); return; }
    setLoading(true);
    timetablesAPI.getReadiness({ sectionId, semester })
      .then((r) => setData(r.data.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [sectionId, semester]);

  if (!sectionId || !semester) return null;
  if (loading) return (
    <div className="readiness-card loading" style={{ textAlign: "center", padding: 16 }}>
      <div className="spinner" style={{ margin: "0 auto" }} />
    </div>
  );
  if (!data) return null;

  return (
    <div className={`readiness-card ${data.isReady ? "ready" : "not-ready"}`}>
      <div className="readiness-title">
        {data.isReady
          ? <CheckCircle size={14} color="var(--success)" />
          : <AlertTriangle size={14} color="var(--danger)" />}
        {data.isReady ? "Ready to Generate" : "Configuration Issues"}
      </div>
      <div className="readiness-stats">
        <div className="readiness-stat"><div className="rs-value">{data.subjectCount}</div><div className="rs-label">Subjects</div></div>
        <div className="readiness-stat"><div className="rs-value">{data.totalWeeklyHours}h</div><div className="rs-label">Weekly Hrs</div></div>
        <div className="readiness-stat"><div className="rs-value">{data.facultyCount}</div><div className="rs-label">Faculty</div></div>
        <div className="readiness-stat"><div className="rs-value">{data.classroomCount}</div><div className="rs-label">Rooms</div></div>
        <div className="readiness-stat"><div className="rs-value">{data.workingDayCount}</div><div className="rs-label">Work Days</div></div>
        <div className="readiness-stat"><div className="rs-value">{data.totalAvailableSlots}</div><div className="rs-label">Total Slots</div></div>
      </div>
      {data.issues.length > 0 && (
        <ul className="readiness-issues">
          {data.issues.map((issue, i) => <li key={i}>{issue}</li>)}
        </ul>
      )}
    </div>
  );
}

// ── Conflict Panel ────────────────────────────────────────────────────────────
function ConflictPanel({ result, onClose }) {
  const [filterType, setFilterType] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [expanded, setExpanded] = useState(true);

  if (!result) return null;

  const conflicts = result.conflicts || [];
  const filtered = conflicts.filter((c) => {
    if (filterType && c.type !== filterType) return false;
    if (filterSeverity && c.severity !== filterSeverity) return false;
    return true;
  });

  const types = [...new Set(conflicts.map((c) => c.type))];

  return (
    <div className="conflict-panel">
      {/* Header */}
      <div className="conflict-panel-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {result.valid
            ? <ShieldCheck size={16} color="var(--success)" />
            : <ShieldAlert size={16} color="var(--danger)" />}
          <span style={{ fontWeight: 700, fontSize: 13 }}>
            {result.valid ? "Validation Passed" : "Validation Failed"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {onClose && (
            <button className="btn btn-secondary btn-sm btn-icon" onClick={onClose}>
              <XCircle size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Summary row */}
      <div className="conflict-summary-row">
        <div className="cs-stat cs-total">
          <span className="cs-val">{result.totalChecked}</span>
          <span className="cs-lbl">Checked</span>
        </div>
        <div className={`cs-stat ${result.errorCount > 0 ? "cs-error" : "cs-ok"}`}>
          <span className="cs-val">{result.errorCount}</span>
          <span className="cs-lbl">Errors</span>
        </div>
        <div className={`cs-stat ${result.warningCount > 0 ? "cs-warn" : "cs-ok"}`}>
          <span className="cs-val">{result.warningCount}</span>
          <span className="cs-lbl">Warnings</span>
        </div>
      </div>

      {expanded && conflicts.length > 0 && (
        <>
          {/* Filters */}
          <div className="conflict-filters">
            <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)}>
              <option value="">All Severity</option>
              <option value="error">Errors only</option>
              <option value="warning">Warnings only</option>
            </select>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="">All Types</option>
              {types.map((t) => (
                <option key={t} value={t}>{CONFLICT_LABELS[t] || t}</option>
              ))}
            </select>
            {(filterType || filterSeverity) && (
              <button className="btn btn-secondary btn-sm" onClick={() => { setFilterType(""); setFilterSeverity(""); }}>
                Clear
              </button>
            )}
          </div>

          {/* Conflict list */}
          <div className="conflict-list">
            {filtered.length === 0 ? (
              <div style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-secondary)" }}>
                No conflicts match the current filter.
              </div>
            ) : (
              filtered.map((c, i) => (
                <div key={i} className={`conflict-item conflict-${c.severity}`}>
                  <div className="ci-header">
                    <span className={`ci-badge ${c.severity === "error" ? "ci-badge-error" : "ci-badge-warn"}`}>
                      {c.severity === "error" ? <XCircle size={10} /> : <AlertTriangle size={10} />}
                      {CONFLICT_LABELS[c.type] || c.type}
                    </span>
                    {c.day && <span className="ci-day">{c.day}</span>}
                    {c.startTime && <span className="ci-time">{c.startTime}–{c.endTime}</span>}
                  </div>
                  <div className="ci-message">{c.message}</div>
                  {c.suggestion && (
                    <div className="ci-suggestion">💡 {c.suggestion}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}

      {expanded && conflicts.length === 0 && (
        <div className="conflict-ok-msg">
          <CheckCircle size={14} color="var(--success)" />
          All {result.totalChecked} entries passed every hard constraint check.
          {result.warningCount > 0 && ` (${result.warningCount} soft warning(s) noted above)`}
        </div>
      )}
    </div>
  );
}

// ── Timetable Grid ────────────────────────────────────────────────────────────
function TimetableGrid({ timetable, filterDay, filterFaculty, filterRoom, conflictEntryIndices }) {
  if (!timetable?.entries?.length) {
    return <EmptyState title="No classes scheduled" message="The timetable has no entries to display." />;
  }

  const slotMap = {};
  timetable.entries.forEach((e) => {
    if (e.timeSlot?._id) slotMap[String(e.timeSlot._id)] = e.timeSlot;
  });
  const slots = Object.values(slotMap).sort((a, b) => a.startTime.localeCompare(b.startTime));

  const configDays = timetable.generationConfig?.workingDays || [];
  const entryDays = [...new Set(timetable.entries.map((e) => e.day))];
  const allDays = configDays.length > 0 ? configDays : DAYS_ORDER.filter((d) => entryDays.includes(d));
  const displayDays = filterDay ? allDays.filter((d) => d === filterDay) : allDays;

  const typeClass = { Theory: "theory", Practical: "practical", Lab: "lab" };

  const getCellEntries = (day, slotId) =>
    timetable.entries.map((e, idx) => ({ ...e, _entryIdx: idx })).filter((e) => {
      if (e.day !== day) return false;
      if (String(e.timeSlot?._id) !== String(slotId)) return false;
      if (filterFaculty && String(e.faculty?._id) !== filterFaculty) return false;
      if (filterRoom && String(e.classroom?._id) !== filterRoom) return false;
      return true;
    });

  return (
    <div className="tt-grid-scroll">
      <table className="tt-grid">
        <thead>
          <tr>
            <th className="slot-col">Time Slot</th>
            {displayDays.map((d) => <th key={d}>{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => (
            <tr key={slot._id}>
              <td className="slot-label">
                <div style={{ fontWeight: 700 }}>{slot.slotName}</div>
                <div style={{ fontSize: 11 }}>{slot.startTime} – {slot.endTime}</div>
              </td>
              {displayDays.map((day) => {
                const entries = getCellEntries(day, slot._id);
                return (
                  <td key={day}>
                    {entries.length === 0
                      ? <div className="tt-cell-empty" />
                      : entries.map((e, i) => {
                          const hasConflict = conflictEntryIndices?.has(e._entryIdx);
                          return (
                            <div
                              key={i}
                              className={`tt-class-card ${typeClass[e.subject?.subjectType] || "theory"}${hasConflict ? " tt-card-conflict" : ""}`}
                            >
                              {hasConflict && <div className="tt-conflict-flag">⚠ Conflict</div>}
                              <div className="cc-subject">{e.subject?.name}</div>
                              <div className="cc-code">{e.subject?.code} · {e.subject?.subjectType}</div>
                              <div className="cc-faculty">👤 {e.faculty?.name}</div>
                              <div className="cc-room">🏫 {e.classroom?.roomNumber}</div>
                              {e.isLabSession && <div style={{ fontSize: 10, color: "#8b5cf6", marginTop: 2 }}>🔬 Lab</div>}
                            </div>
                          );
                        })
                    }
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

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Timetable() {
  const [departments, setDepartments] = useState([]);
  const [allSections, setAllSections] = useState([]);
  const [filteredSections, setFilteredSections] = useState([]);
  const [timetables, setTimetables] = useState([]);
  const [activeTimetable, setActiveTimetable] = useState(null);

  const [form, setForm] = useState({ department: "", section: "", academicYear: "", semester: "" });
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [validating, setValidating] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showUnscheduled, setShowUnscheduled] = useState(false);

  // Validation result state
  const [validationResult, setValidationResult] = useState(null);

  // Grid filters
  const [filterDay, setFilterDay] = useState("");
  const [filterFaculty, setFilterFaculty] = useState("");
  const [filterRoom, setFilterRoom] = useState("");

  useEffect(() => {
    departmentsAPI.getAll().then((r) => setDepartments(r.data.data)).catch(() => {});
    sectionsAPI.getAll().then((r) => setAllSections(r.data.data)).catch(() => {});
    fetchTimetables();
  }, []);

  useEffect(() => {
    if (!form.department) {
      setFilteredSections([]);
      setForm((prev) => ({ ...prev, section: "" }));
      return;
    }
    const filtered = allSections.filter((s) => {
      const deptId = s.department?._id ? String(s.department._id) : String(s.department);
      return deptId === form.department;
    });
    setFilteredSections(filtered);
    setForm((prev) => ({ ...prev, section: "" }));
  }, [form.department, allSections]);

  const fetchTimetables = async () => {
    setListLoading(true);
    try {
      const r = await timetablesAPI.getAll();
      setTimetables(r.data.data);
    } catch { }
    finally { setListLoading(false); }
  };

  const isFormValid = form.section && form.academicYear.trim() && form.semester;

  const handleGenerate = async () => {
    if (!isFormValid) {
      return setAlert({ type: "error", message: "Please fill in all fields: Department, Section, Academic Year, and Semester." });
    }
    setGenerating(true);
    setAlert(null);
    setActiveTimetable(null);
    setValidationResult(null);
    setShowUnscheduled(false);
    try {
      const r = await timetablesAPI.generate({
        sectionId: form.section,
        academicYear: form.academicYear.trim(),
        semester: Number(form.semester),
      });
      setActiveTimetable(r.data.data);
      setAlert({ type: "success", message: r.data.message });
      fetchTimetables();
    } catch (err) {
      setAlert({ type: "error", message: err.response?.data?.message || "Generation failed. Check your configuration." });
    } finally { setGenerating(false); }
  };

  const handleView = async (id) => {
    try {
      const r = await timetablesAPI.getOne(id);
      setActiveTimetable(r.data.data);
      setValidationResult(null);
      setShowUnscheduled(false);
      setFilterDay(""); setFilterFaculty(""); setFilterRoom("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setAlert({ type: "error", message: "Failed to load timetable." });
    }
  };

  const handleValidate = async () => {
    if (!activeTimetable) return;
    setValidating(true);
    setValidationResult(null);
    try {
      const r = await timetablesAPI.validate(activeTimetable._id);
      setValidationResult(r.data);
      setAlert({
        type: r.data.valid ? "success" : "error",
        message: r.data.message,
      });
    } catch (err) {
      setAlert({ type: "error", message: err.response?.data?.message || "Validation failed." });
    } finally { setValidating(false); }
  };

  const handlePublish = async () => {
    if (!activeTimetable) return;
    setPublishing(true);
    try {
      const r = await timetablesAPI.publish(activeTimetable._id);
      setAlert({ type: "success", message: r.data.message });
      setActiveTimetable((prev) => ({ ...prev, status: "published" }));
      fetchTimetables();
    } catch (err) {
      setAlert({ type: "error", message: err.response?.data?.message || "Publish failed." });
    } finally { setPublishing(false); }
  };

  const handleRegenerate = async () => {
    if (!activeTimetable) return;
    setGenerating(true);
    setAlert(null);
    setValidationResult(null);
    try {
      const r = await timetablesAPI.regenerate(activeTimetable._id);
      setActiveTimetable(r.data.data);
      setAlert({ type: "success", message: r.data.message });
      fetchTimetables();
    } catch (err) {
      setAlert({ type: "error", message: err.response?.data?.message || "Regeneration failed." });
    } finally { setGenerating(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await timetablesAPI.remove(deleteId);
      setAlert({ type: "success", message: "Draft deleted." });
      if (activeTimetable?._id === deleteId) { setActiveTimetable(null); setValidationResult(null); }
      setDeleteId(null);
      fetchTimetables();
    } catch (err) {
      setAlert({ type: "error", message: err.response?.data?.message || "Delete failed." });
    } finally { setDeleting(false); }
  };

  const uniqueFaculty = activeTimetable
    ? [...new Map(
        activeTimetable.entries?.filter((e) => e.faculty?._id).map((e) => [String(e.faculty._id), e.faculty])
      ).values()]
    : [];

  const uniqueRooms = activeTimetable
    ? [...new Map(
        activeTimetable.entries?.filter((e) => e.classroom?._id).map((e) => [String(e.classroom._id), e.classroom])
      ).values()]
    : [];

  const activeDays = activeTimetable?.generationConfig?.workingDays?.length
    ? activeTimetable.generationConfig.workingDays
    : DAYS_ORDER.filter((d) => activeTimetable?.entries?.some((e) => e.day === d));

  // Build set of entry indices that have conflicts (for grid highlighting)
  const conflictEntryIndices = validationResult
    ? new Set(
        (validationResult.conflicts || []).flatMap((c) => {
          const idxs = [];
          if (c.entryIndex != null) idxs.push(c.entryIndex);
          if (c.entryIndexA != null) idxs.push(c.entryIndexA);
          if (c.entryIndexB != null) idxs.push(c.entryIndexB);
          return idxs;
        })
      )
    : null;

  return (
    <div>
      <div className="page-header">
        <h1>Timetable Generator</h1>
      </div>

      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

      <div className="tt-layout">

        {/* ── Left: Config Panel ── */}
        <div className="tt-config-panel">
          <h2><Zap size={16} color="var(--primary)" /> Generate Timetable</h2>

          <div className="form-group">
            <label>Department *</label>
            <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
              <option value="">— Select Department —</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>{d.name} ({d.code})</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Section *</label>
            <select
              value={form.section}
              onChange={(e) => setForm({ ...form, section: e.target.value })}
              disabled={!form.department}
            >
              <option value="">— Select Section —</option>
              {filteredSections.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} — Sem {s.semester} ({s.academicYear})
                </option>
              ))}
            </select>
            {form.department && filteredSections.length === 0 && (
              <div className="field-error">No sections found for this department. Add a section first.</div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Academic Year *</label>
              <input
                value={form.academicYear}
                onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
                placeholder="e.g. 2024-25"
              />
            </div>
            <div className="form-group">
              <label>Semester *</label>
              <select value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })}>
                <option value="">—</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <option key={s} value={s}>Sem {s}</option>
                ))}
              </select>
            </div>
          </div>

          <ReadinessPanel sectionId={form.section} semester={form.semester} />

          <button className="tt-generate-btn" onClick={handleGenerate} disabled={generating}>
            {generating
              ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Generating...</>
              : <><Zap size={16} /> Generate Timetable</>
            }
          </button>

          {!isFormValid && !generating && (
            <p style={{ fontSize: 11, color: "var(--text-secondary)", textAlign: "center", marginTop: 6 }}>
              Fill all fields above to enable generation
            </p>
          )}

          {activeTimetable && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                className="btn btn-secondary"
                style={{ width: "100%", justifyContent: "center" }}
                onClick={handleValidate}
                disabled={validating}
              >
                <CheckCircle size={14} /> {validating ? "Validating..." : "Validate Constraints"}
              </button>

              {activeTimetable.status !== "published" && (
                <button
                  className="btn btn-success"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={handlePublish}
                  disabled={publishing}
                >
                  <CheckCircle size={14} /> {publishing ? "Publishing..." : "Publish Timetable"}
                </button>
              )}

              <button
                className="btn btn-secondary"
                style={{ width: "100%", justifyContent: "center" }}
                onClick={handleRegenerate}
                disabled={generating}
              >
                <RefreshCw size={14} /> Regenerate
              </button>

              <button
                className="btn btn-secondary"
                style={{ width: "100%", justifyContent: "center" }}
                onClick={() => window.print()}
              >
                <Printer size={14} /> Print
              </button>
            </div>
          )}
        </div>

        {/* ── Right: Grid + Conflict Panel + List ── */}
        <div>
          {activeTimetable ? (
            <div className="tt-grid-wrapper">
              <div className="tt-grid-header">
                <div>
                  <h2 style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {activeTimetable.section?.name} — Sem {activeTimetable.semester} ({activeTimetable.academicYear})
                    <StatusBadge status={activeTimetable.status} />
                  </h2>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                    {activeTimetable.department?.name}
                  </div>
                </div>
                <QualityScore score={activeTimetable.statistics?.qualityScore || 0} />
              </div>

              {/* Stats bar */}
              <div className="tt-stats-bar">
                <div className="tt-stat">
                  <span className="ts-value" style={{ color: "var(--primary)" }}>
                    {activeTimetable.statistics?.scheduledTasks}
                  </span>
                  <span className="ts-label">/ {activeTimetable.statistics?.requiredTasks} Scheduled</span>
                </div>
                <div className="tt-stat">
                  <span className="ts-value" style={{ color: activeTimetable.statistics?.unscheduledTasks > 0 ? "var(--danger)" : "var(--success)" }}>
                    {activeTimetable.statistics?.unscheduledTasks}
                  </span>
                  <span className="ts-label">Unscheduled</span>
                </div>
                <div className="tt-stat">
                  <span className="ts-value">{activeTimetable.statistics?.generationTimeMs}ms</span>
                  <span className="ts-label">Gen time</span>
                </div>
                <div className="tt-stat">
                  <span className="ts-value">{activeTimetable.entries?.length}</span>
                  <span className="ts-label">Classes/week</span>
                </div>
              </div>

              {/* Validation conflict panel */}
              {validationResult && (
                <div style={{ padding: "0 16px 0" }}>
                  <ConflictPanel
                    result={validationResult}
                    onClose={() => setValidationResult(null)}
                  />
                </div>
              )}

              {/* Filters */}
              <div className="tt-filter-bar">
                <select value={filterDay} onChange={(e) => setFilterDay(e.target.value)}>
                  <option value="">All Days</option>
                  {activeDays.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <select value={filterFaculty} onChange={(e) => setFilterFaculty(e.target.value)}>
                  <option value="">All Faculty</option>
                  {uniqueFaculty.map((f) => <option key={f._id} value={String(f._id)}>{f.name}</option>)}
                </select>
                <select value={filterRoom} onChange={(e) => setFilterRoom(e.target.value)}>
                  <option value="">All Rooms</option>
                  {uniqueRooms.map((r) => <option key={r._id} value={String(r._id)}>{r.roomNumber}</option>)}
                </select>
                {(filterDay || filterFaculty || filterRoom) && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => { setFilterDay(""); setFilterFaculty(""); setFilterRoom(""); }}
                  >
                    Clear
                  </button>
                )}
              </div>

              <TimetableGrid
                timetable={activeTimetable}
                filterDay={filterDay}
                filterFaculty={filterFaculty}
                filterRoom={filterRoom}
                conflictEntryIndices={conflictEntryIndices}
              />

              {/* Unscheduled tasks panel */}
              {activeTimetable.unscheduledTasks?.length > 0 && (
                <div className="unscheduled-panel" style={{ margin: 16 }}>
                  <h3
                    onClick={() => setShowUnscheduled(!showUnscheduled)}
                    style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <AlertTriangle size={14} />
                    {activeTimetable.unscheduledTasks.length} Unscheduled Subject(s)
                    <span style={{ marginLeft: "auto" }}>
                      {showUnscheduled ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </span>
                  </h3>
                  {showUnscheduled && activeTimetable.unscheduledTasks.map((t, i) => (
                    <div key={i} className="unscheduled-item">
                      <div className="ui-subject">
                        {t.subjectName}
                        <span style={{ fontSize: 11, color: "var(--text-secondary)", marginLeft: 6 }}>({t.subjectCode})</span>
                      </div>
                      <div className="ui-reason">{t.reason}</div>
                      <div className="ui-progress">{t.periodsScheduled} / {t.periodsNeeded} periods scheduled</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="tt-grid-wrapper">
              <EmptyState
                title="No timetable selected"
                message="Fill in the configuration on the left and click Generate Timetable."
              />
            </div>
          )}

          {/* Saved Timetables List */}
          <div style={{ marginTop: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Saved Timetables</h2>
            {listLoading ? <LoadingState /> : timetables.length === 0 ? (
              <EmptyState title="No timetables yet" message="Generate your first timetable above." />
            ) : (
              timetables.map((tt) => (
                <div key={tt._id} className="tt-list-item">
                  <div className="tt-list-info">
                    <h3 style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {tt.section?.name} — Sem {tt.semester} ({tt.academicYear})
                      <StatusBadge status={tt.status} />
                    </h3>
                    <p>
                      {tt.department?.name} &nbsp;·&nbsp;
                      {tt.statistics?.scheduledTasks}/{tt.statistics?.requiredTasks} scheduled &nbsp;·&nbsp;
                      Quality: {tt.statistics?.qualityScore}% &nbsp;·&nbsp;
                      {new Date(tt.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="tt-list-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => handleView(tt._id)}>
                      <Eye size={13} /> View
                    </button>
                    {tt.status !== "published" && (
                      <button
                        className="btn btn-danger btn-sm btn-icon"
                        onClick={() => setDeleteId(tt._id)}
                        title="Delete draft"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!deleteId}
        title="Delete Draft Timetable"
        message="Delete this draft? This cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        loading={deleting}
      />
    </div>
  );
}
