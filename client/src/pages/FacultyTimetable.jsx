import { useEffect, useState, useMemo } from "react";
import { timetablesAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { LoadingState, EmptyState } from "../components/States";
import { CalendarRange, Clock, BookOpen, Layers, Printer, Filter, Download } from "lucide-react";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const TYPE_CLASS = { Theory: "theory", Practical: "practical", Lab: "lab" };

// Returns today's day name
const getToday = () => new Date().toLocaleDateString("en-US", { weekday: "long" });

// Returns current time as "HH:MM" for comparison
const getNow = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="summary-card" style={{ borderLeftColor: color }}>
      <div className="summary-icon" style={{ background: color + "22" }}>
        <Icon size={20} color={color} />
      </div>
      <div className="summary-info">
        <div className="count" style={{ fontSize: 20 }}>{value}</div>
        <div className="label">{label}</div>
      </div>
    </div>
  );
}

function TimetableGrid({ schedules, dayFilter }) {
  const allSlots = useMemo(() => {
    const map = {};
    schedules.forEach((tt) =>
      tt.entries.forEach((e) => {
        if (e.timeSlot?._id) map[String(e.timeSlot._id)] = e.timeSlot;
      })
    );
    return Object.values(map).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [schedules]);

  const activeDays = useMemo(() => {
    const days = new Set();
    schedules.forEach((tt) => tt.entries.forEach((e) => days.add(e.day)));
    return DAYS.filter((d) => days.has(d));
  }, [schedules]);

  const displayDays = dayFilter ? activeDays.filter((d) => d === dayFilter) : activeDays;

  if (allSlots.length === 0 || displayDays.length === 0)
    return <EmptyState title="No classes found" message="No entries match the selected filter." />;

  const lookup = {};
  schedules.forEach((tt) =>
    tt.entries.forEach((e) => {
      const key = `${e.day}__${e.timeSlot?._id}`;
      if (!lookup[key]) lookup[key] = [];
      lookup[key].push({ ...e, _ttSection: tt.section, _ttDept: tt.department });
    })
  );

  const today = getToday();

  return (
    <div className="tt-grid-scroll">
      <table className="tt-grid">
        <thead>
          <tr>
            <th className="slot-col">Time Slot</th>
            {displayDays.map((d) => (
              <th key={d} style={d === today ? { background: "var(--primary)" } : {}}>
                {d}{d === today && " ★"}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allSlots.map((slot) => (
            <tr key={slot._id}>
              <td className="slot-label">
                <div style={{ fontWeight: 700 }}>{slot.slotName}</div>
                <div style={{ fontSize: 11 }}>{slot.startTime}–{slot.endTime}</div>
              </td>
              {displayDays.map((day) => {
                const entries = lookup[`${day}__${slot._id}`] || [];
                return (
                  <td key={day} style={day === today ? { background: "#f0f4ff" } : {}}>
                    {entries.length === 0
                      ? <div className="tt-cell-empty" />
                      : entries.map((e, i) => (
                        <div key={i} className={`tt-class-card ${TYPE_CLASS[e.subject?.subjectType] || "theory"}`} style={{ marginBottom: 4 }}>
                          <div className="cc-subject">{e.subject?.name}</div>
                          <div className="cc-code">{e.subject?.code} · {e.subject?.subjectType}</div>
                          <div className="cc-faculty" style={{ fontSize: 10 }}>{e._ttSection?.name} · {e._ttDept?.name}</div>
                          <div className="cc-room">🏫 {e.classroom?.roomNumber}{e.classroom?.building ? ` · ${e.classroom.building}` : ""}</div>
                          {e.isLabSession && <div style={{ fontSize: 10, color: "#8b5cf6", marginTop: 2 }}>🔬 Lab</div>}
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
  );
}

// Export all entries to CSV
function exportCSV(schedules, userName) {
  const rows = [["Subject", "Code", "Type", "Section", "Department", "Semester", "Day", "Start", "End", "Room", "Building"]];
  schedules.forEach((tt) =>
    tt.entries.forEach((e) => {
      rows.push([
        e.subject?.name || "",
        e.subject?.code || "",
        e.subject?.subjectType || "",
        tt.section?.name || "",
        tt.department?.name || "",
        tt.semester || "",
        e.day || "",
        e.timeSlot?.startTime || "",
        e.timeSlot?.endTime || "",
        e.classroom?.roomNumber || "",
        e.classroom?.building || "",
      ]);
    })
  );
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `timetable_${userName.replace(/\s+/g, "_")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function FacultyTimetable() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dayFilter, setDayFilter] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    timetablesAPI.getMySchedule({ day: dayFilter || undefined })
      .then((res) => { setSchedules(res.data.data); setStats(res.data.stats); })
      .catch((err) => setError(err.response?.data?.message || "Failed to load schedule."))
      .finally(() => setLoading(false));
  }, [dayFilter]);

  const activeDays = useMemo(() => {
    const days = new Set();
    schedules.forEach((tt) => tt.entries.forEach((e) => days.add(e.day)));
    return DAYS.filter((d) => days.has(d));
  }, [schedules]);

  const today = getToday();
  const now = getNow();

  // Today's classes sorted by start time
  const todayClasses = useMemo(() =>
    schedules.flatMap((tt) =>
      tt.entries
        .filter((e) => e.day === today)
        .map((e) => ({ ...e, _section: tt.section, _dept: tt.department }))
    ).sort((a, b) => (a.timeSlot?.startTime || "").localeCompare(b.timeSlot?.startTime || "")),
    [schedules, today]
  );

  // Next upcoming class = first class today whose start time is after now
  const nextClass = useMemo(() =>
    todayClasses.find((e) => (e.timeSlot?.startTime || "") > now) || null,
    [todayClasses, now]
  );

  if (loading) return <LoadingState message="Loading your timetable..." />;

  if (error) return (
    <div>
      <div className="page-header"><h1>My Timetable</h1></div>
      <div className="alert alert-error">{error}</div>
    </div>
  );

  if (schedules.length === 0) return (
    <div>
      <div className="page-header"><h1>My Timetable</h1></div>
      <EmptyState
        title="No classes assigned"
        message="No published timetable entries are assigned to you yet. Contact the administrator."
      />
    </div>
  );

  return (
    <div>
      {/* Print-only header (hidden on screen) */}
      <div className="print-only-header">
        <strong>My Timetable — {user?.name}</strong>
      </div>

      <div className="page-header">
        <div>
          <h1>My Timetable</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            {user?.name} · {today}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => exportCSV(schedules, user?.name || "faculty")}>
            <Download size={14} /> Export CSV
          </button>
          <button className="btn btn-secondary" onClick={() => window.print()}>
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="summary-grid" style={{ marginBottom: 20 }}>
        <StatCard icon={BookOpen}     label="Total Classes"   value={stats?.totalClasses ?? 0}  color="#4f46e5" />
        <StatCard icon={Clock}        label="Classes Today"   value={stats?.classesToday ?? 0}  color="#10b981" />
        <StatCard icon={Layers}       label="Sections Taught" value={stats?.sectionsCount ?? 0} color="#f59e0b" />
        <StatCard icon={CalendarRange} label="Active Days"    value={activeDays.length}          color="#06b6d4" />
      </div>

      {/* Next upcoming class */}
      {nextClass && (
        <div className="alert alert-success" style={{ marginBottom: 16, alignItems: "flex-start", flexDirection: "column", gap: 4 }}>
          <strong style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Clock size={14} /> Next Class Today
          </strong>
          <span>
            {nextClass.subject?.name} ({nextClass.subject?.code}) · {nextClass.timeSlot?.startTime}–{nextClass.timeSlot?.endTime} · 🏫 {nextClass.classroom?.roomNumber} · {nextClass._section?.name}
          </span>
        </div>
      )}

      {/* Today's Schedule */}
      {todayClasses.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <Clock size={15} color="var(--primary)" /> Today's Schedule — {today}
          </h3>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {todayClasses.map((e, i) => (
              <div key={i} className={`tt-class-card ${TYPE_CLASS[e.subject?.subjectType] || "theory"}`} style={{ minWidth: 160 }}>
                <div className="cc-subject">{e.subject?.name}</div>
                <div className="cc-code">{e.subject?.code}</div>
                <div className="cc-room">{e.timeSlot?.startTime}–{e.timeSlot?.endTime}</div>
                <div className="cc-room">🏫 {e.classroom?.roomNumber}</div>
                <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>{e._section?.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekly Grid */}
      <div className="tt-grid-wrapper">
        <div className="tt-grid-header">
          <h2 style={{ fontSize: 15, fontWeight: 700 }}>Weekly Timetable</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Filter size={14} color="var(--text-secondary)" />
            <select
              value={dayFilter}
              onChange={(e) => setDayFilter(e.target.value)}
              style={{ padding: "5px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, background: "var(--surface)" }}
            >
              <option value="">All Days</option>
              {activeDays.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            {dayFilter && <button className="btn btn-secondary btn-sm" onClick={() => setDayFilter("")}>Clear</button>}
          </div>
        </div>

        <div style={{ padding: "8px 20px", borderBottom: "1px solid var(--border)", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {schedules.map((tt) => (
            <span key={tt._id} className="badge badge-purple">
              {tt.section?.name} · {tt.department?.name} · Sem {tt.semester}
            </span>
          ))}
        </div>

        <TimetableGrid schedules={schedules} dayFilter={dayFilter} />
      </div>
    </div>
  );
}
