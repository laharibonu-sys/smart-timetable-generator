import { useEffect, useState, useMemo } from "react";
import { timetablesAPI, departmentsAPI, sectionsAPI, facultyAPI, classroomsAPI, subjectsAPI } from "../services/api";
import { LoadingState, EmptyState } from "../components/States";
import { Filter, Printer, Eye, BarChart2, Download } from "lucide-react";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const TYPE_CLASS = { Theory: "theory", Practical: "practical", Lab: "lab" };

function exportCSV(timetable) {
  if (!timetable) return;
  const rows = [["Subject", "Code", "Type", "Faculty", "Day", "Start", "End", "Room"]];
  timetable.entries.forEach((e) => {
    rows.push([
      e.subject?.name || "",
      e.subject?.code || "",
      e.subject?.subjectType || "",
      e.faculty?.name || "",
      e.day || "",
      e.timeSlot?.startTime || "",
      e.timeSlot?.endTime || "",
      e.classroom?.roomNumber || "",
    ]);
  });
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `timetable_${timetable.section?.name || "section"}_sem${timetable.semester}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ViewTimetables() {
  // Filter state
  const [filters, setFilters] = useState({ department: "", semester: "", academicYear: "", section: "", faculty: "", classroom: "", subject: "", day: "" });

  // Dropdown data
  const [departments, setDepartments] = useState([]);
  const [sections, setSections] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [subjects, setSubjects] = useState([]);

  // Results
  const [timetables, setTimetables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [activeTT, setActiveTT] = useState(null);

  // Load dropdown data once
  useEffect(() => {
    Promise.all([
      departmentsAPI.getAll(),
      sectionsAPI.getAll(),
      facultyAPI.getAll(),
      classroomsAPI.getAll(),
      subjectsAPI.getAll(),
    ]).then(([d, s, f, c, sub]) => {
      setDepartments(d.data.data || []);
      setSections(s.data.data || []);
      setFacultyList(f.data.data || []);
      setClassrooms(c.data.data || []);
      setSubjects(sub.data.data || []);
    }).catch(() => {});
  }, []);

  // Filter sections by selected department
  const filteredSections = useMemo(() =>
    filters.department
      ? sections.filter((s) => String(s.department?._id || s.department) === filters.department)
      : sections,
    [sections, filters.department]
  );

  const setFilter = (key, val) => setFilters((prev) => ({ ...prev, [key]: val, ...(key === "department" ? { section: "" } : {}) }));

  const handleSearch = () => {
    setLoading(true);
    setActiveTT(null);
    const params = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    timetablesAPI.viewTimetables(params)
      .then((res) => { setTimetables(res.data.data || []); setFetched(true); })
      .catch(() => { setTimetables([]); setFetched(true); })
      .finally(() => setLoading(false));
  };

  const clearFilters = () => {
    setFilters({ department: "", semester: "", academicYear: "", section: "", faculty: "", classroom: "", subject: "", day: "" });
    setTimetables([]);
    setFetched(false);
    setActiveTT(null);
  };

  // Stats across all returned timetables
  const totalEntries = timetables.reduce((s, tt) => s + tt.entries.length, 0);

  // Grid for active timetable
  const gridSlots = useMemo(() => {
    if (!activeTT) return [];
    const map = {};
    activeTT.entries.forEach((e) => {
      if (e.timeSlot?._id) map[String(e.timeSlot._id)] = e.timeSlot;
    });
    return Object.values(map).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [activeTT]);

  const gridDays = useMemo(() => {
    if (!activeTT) return [];
    const days = new Set(activeTT.entries.map((e) => e.day));
    return DAYS.filter((d) => days.has(d));
  }, [activeTT]);

  const gridLookup = useMemo(() => {
    if (!activeTT) return {};
    const map = {};
    activeTT.entries.forEach((e) => {
      const key = `${e.day}__${e.timeSlot?._id}`;
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [activeTT]);

  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>View Timetables</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>Browse published timetables by department, section, faculty, or classroom</p>
        </div>
        {activeTT && (
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => exportCSV(activeTT)}>
              <Download size={14} /> Export CSV
            </button>
            <button className="btn btn-secondary" onClick={() => window.print()}>
              <Printer size={14} /> Print
            </button>
          </div>
        )}
      </div>

      {/* Filter Panel */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Filter size={15} color="var(--primary)" />
          <span style={{ fontWeight: 700, fontSize: 14 }}>Filters</span>
        </div>
        <div className="form-row" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Department</label>
            <select value={filters.department} onChange={(e) => setFilter("department", e.target.value)}>
              <option value="">All Departments</option>
              {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Semester</label>
            <select value={filters.semester} onChange={(e) => setFilter("semester", e.target.value)}>
              <option value="">All Semesters</option>
              {[1,2,3,4,5,6,7,8].map((s) => <option key={s} value={s}>Sem {s}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Academic Year</label>
            <input value={filters.academicYear} onChange={(e) => setFilter("academicYear", e.target.value)} placeholder="e.g. 2024-25" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Section</label>
            <select value={filters.section} onChange={(e) => setFilter("section", e.target.value)}>
              <option value="">All Sections</option>
              {filteredSections.map((s) => <option key={s._id} value={s._id}>{s.name} · Sem {s.semester}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Faculty</label>
            <select value={filters.faculty} onChange={(e) => setFilter("faculty", e.target.value)}>
              <option value="">All Faculty</option>
              {facultyList.map((f) => <option key={f._id} value={f._id}>{f.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Classroom</label>
            <select value={filters.classroom} onChange={(e) => setFilter("classroom", e.target.value)}>
              <option value="">All Classrooms</option>
              {classrooms.map((c) => <option key={c._id} value={c._id}>{c.roomNumber}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Subject</label>
            <select value={filters.subject} onChange={(e) => setFilter("subject", e.target.value)}>
              <option value="">All Subjects</option>
              {subjects.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Day</label>
            <select value={filters.day} onChange={(e) => setFilter("day", e.target.value)}>
              <option value="">All Days</option>
              {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button className="btn btn-primary" onClick={handleSearch} disabled={loading}>
            <Filter size={14} /> {loading ? "Searching..." : "Search"}
          </button>
          <button className="btn btn-secondary" onClick={clearFilters}>Clear</button>
        </div>
      </div>

      {/* Summary stats */}
      {fetched && (
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <div className="badge badge-purple" style={{ padding: "6px 12px", fontSize: 13 }}>
            <BarChart2 size={13} style={{ marginRight: 4 }} />
            {timetables.length} timetable{timetables.length !== 1 ? "s" : ""}
          </div>
          <div className="badge badge-info" style={{ padding: "6px 12px", fontSize: 13 }}>
            {totalEntries} class entries
          </div>
        </div>
      )}

      {loading && <LoadingState message="Fetching timetables..." />}

      {!loading && fetched && timetables.length === 0 && (
        <EmptyState title="No timetables found" message="No published timetables match the selected filters." />
      )}

      {!loading && !fetched && (
        <div className="empty-state" style={{ padding: 40 }}>
          <Filter size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
          <h3>Select filters and click Search</h3>
          <p>Use the filters above to find published timetables.</p>
        </div>
      )}

      {/* Timetable list */}
      {!loading && timetables.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          {timetables.map((tt) => (
            <div key={tt._id} className="tt-list-item" style={{ cursor: "pointer", border: activeTT?._id === tt._id ? "2px solid var(--primary)" : undefined }}
              onClick={() => setActiveTT(activeTT?._id === tt._id ? null : tt)}>
              <div className="tt-list-info">
                <h3>{tt.section?.name} — Sem {tt.semester} ({tt.academicYear})
                  <span className="badge badge-success" style={{ marginLeft: 8 }}>published</span>
                </h3>
                <p>{tt.department?.name} · {tt.entries.length} entries</p>
              </div>
              <button className="btn btn-secondary btn-sm">
                <Eye size={13} /> {activeTT?._id === tt._id ? "Hide" : "View"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Active timetable grid */}
      {activeTT && (
        <div className="tt-grid-wrapper">
          <div className="tt-grid-header">
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700 }}>
                {activeTT.section?.name} — {activeTT.department?.name} · Sem {activeTT.semester} · {activeTT.academicYear}
              </h2>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{activeTT.entries.length} scheduled classes</p>
            </div>
          </div>
          <div className="tt-grid-scroll">
            <table className="tt-grid">
              <thead>
                <tr>
                  <th className="slot-col">Time Slot</th>
                  {gridDays.map((d) => (
                    <th key={d} style={d === today ? { background: "var(--primary)", color: "white" } : {}}>{d}{d === today && " ★"}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gridSlots.map((slot) => (
                  <tr key={slot._id}>
                    <td className="slot-label">
                      <div style={{ fontWeight: 700 }}>{slot.slotName}</div>
                      <div style={{ fontSize: 11 }}>{slot.startTime}–{slot.endTime}</div>
                    </td>
                    {gridDays.map((day) => {
                      const entries = gridLookup[`${day}__${slot._id}`] || [];
                      return (
                        <td key={day} style={day === today ? { background: "#f0f4ff" } : {}}>
                          {entries.length === 0
                            ? <div className="tt-cell-empty" />
                            : entries.map((e, i) => (
                              <div key={i} className={`tt-class-card ${TYPE_CLASS[e.subject?.subjectType] || "theory"}`} style={{ marginBottom: 4 }}>
                                <div className="cc-subject">{e.subject?.name}</div>
                                <div className="cc-code">{e.subject?.code} · {e.subject?.subjectType}</div>
                                <div className="cc-faculty">👤 {e.faculty?.name}</div>
                                <div className="cc-room">🏫 {e.classroom?.roomNumber}</div>
                              </div>
                            ))
                          }
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
