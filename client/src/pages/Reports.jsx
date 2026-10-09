import { useState, useEffect, useCallback, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid,
} from "recharts";
import {
  BarChart2, Users, Building2, BookOpen, AlertTriangle, CheckCircle,
  Download, RefreshCw, Filter, ChevronUp, ChevronDown, Search,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  reportsAPI, departmentsAPI, sectionsAPI, facultyAPI,
  classroomsAPI, timetablesAPI,
} from "../services/api";
import { LoadingState, EmptyState } from "../components/States";
import Alert from "../components/Alert";
import Pagination from "../components/Pagination";

// ── Constants ─────────────────────────────────────────────────────────────────
const COLORS = ["#4f46e5","#06b6d4","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#14b8a6"];
const PAGE_SIZE = 15;
const TABS = ["Summary","Faculty Workload","Classroom Utilization","Scheduling Completion","Conflicts","Departments"];

const CONFLICT_LABELS = {
  FACULTY_CONFLICT:"Faculty Clash", ROOM_CONFLICT:"Room Clash",
  SECTION_CONFLICT:"Section Clash", DUPLICATE_ALLOCATION:"Duplicate Entry",
  INVALID_FACULTY:"Invalid Faculty", INACTIVE_FACULTY:"Inactive Faculty",
  FACULTY_NOT_ELIGIBLE:"Faculty Not Eligible", INVALID_ROOM:"Invalid Room",
  ROOM_UNAVAILABLE:"Room Unavailable", ROOM_TYPE_MISMATCH:"Wrong Room Type",
  ROOM_CAPACITY:"Room Too Small", INVALID_WORKING_DAY:"Non-Working Day",
  INVALID_TIME_SLOT:"Invalid Slot", INACTIVE_TIME_SLOT:"Inactive Slot",
  CLASS_DURING_BREAK:"Class in Break", INSUFFICIENT_WEEKLY_HOURS:"Under-Scheduled",
  EXCESS_WEEKLY_HOURS:"Over-Scheduled", LAB_MISSING_CONSECUTIVE_SLOT:"Lab: Missing Slot",
  LAB_INVALID_CONSECUTIVE_SLOT:"Lab: Invalid Slot", LAB_NON_CONSECUTIVE_SLOTS:"Lab: Non-Consecutive",
  FACULTY_OVERLOADED:"Faculty Overloaded",
};

// ── Small reusable components ─────────────────────────────────────────────────
function StatCard({ label, value, color, icon: Icon, sub }) {
  return (
    <div className="summary-card" style={{ borderLeftColor: color }}>
      <div className="summary-icon" style={{ background: color + "22" }}>
        <Icon size={22} color={color} />
      </div>
      <div className="summary-info">
        <div className="count" style={{ color }}>{value ?? "—"}</div>
        <div className="label">{label}</div>
        {sub && <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function SortTh({ label, field, sort, onSort }) {
  const active = sort.field === field;
  return (
    <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => onSort(field)}>
      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {label}
        {active ? (sort.dir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : null}
      </span>
    </th>
  );
}

function useSortedPaged(rows, sort, page) {
  return useMemo(() => {
    const sorted = [...rows].sort((a, b) => {
      const av = a[sort.field], bv = b[sort.field];
      if (av == null) return 1; if (bv == null) return -1;
      const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
      return sort.dir === "asc" ? cmp : -cmp;
    });
    const total = sorted.length;
    const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    return { sorted, paged, total };
  }, [rows, sort, page]);
}

// ── CSV export helper ─────────────────────────────────────────────────────────
function exportCSV(filename, headers, rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── PDF export helper ─────────────────────────────────────────────────────────
function exportPDF(title, filters, headers, rows, filename) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFontSize(14); doc.setFont("helvetica", "bold");
  doc.text("Smart Timetable Generator — " + title, 148, 14, { align: "center" });
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.text(`Filters: ${filters || "None"} | Generated: ${new Date().toLocaleString()}`, 148, 21, { align: "center" });
  autoTable(doc, {
    head: [headers], body: rows, startY: 28,
    styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: [30, 27, 75], textColor: 255, fontStyle: "bold" },
    didDrawPage: (d) => {
      doc.setFontSize(8);
      doc.text(`Page ${d.pageNumber}`, doc.internal.pageSize.width - 15, doc.internal.pageSize.height - 8);
    },
  });
  doc.save(filename);
}

// ── Filter Panel ──────────────────────────────────────────────────────────────
function FilterPanel({ filters, setFilters, departments, sections, facultyList, classrooms, timetables }) {
  const filteredSections = useMemo(() =>
    filters.department
      ? sections.filter((s) => String(s.department?._id || s.department) === filters.department)
      : sections,
    [sections, filters.department]
  );

  const set = (k, v) => setFilters((p) => ({
    ...p, [k]: v,
    ...(k === "department" ? { section: "" } : {}),
  }));

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Filter size={14} color="var(--primary)" />
        <span style={{ fontWeight: 700, fontSize: 13 }}>Filters</span>
        <button className="btn btn-secondary btn-sm" style={{ marginLeft: "auto" }}
          onClick={() => setFilters({ department: "", semester: "", academicYear: "", section: "", status: "published" })}>
          Clear
        </button>
      </div>
      <div className="form-row" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Department</label>
          <select value={filters.department} onChange={(e) => set("department", e.target.value)}>
            <option value="">All</option>
            {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Semester</label>
          <select value={filters.semester} onChange={(e) => set("semester", e.target.value)}>
            <option value="">All</option>
            {[1,2,3,4,5,6,7,8].map((s) => <option key={s} value={s}>Sem {s}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Academic Year</label>
          <input value={filters.academicYear} onChange={(e) => set("academicYear", e.target.value)} placeholder="e.g. 2024-25" />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Section</label>
          <select value={filters.section} onChange={(e) => set("section", e.target.value)}>
            <option value="">All</option>
            {filteredSections.map((s) => <option key={s._id} value={s._id}>{s.name} · Sem {s.semester}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Timetable Status</label>
          <select value={filters.status} onChange={(e) => set("status", e.target.value)}>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="">Published + Draft</option>
          </select>
        </div>
      </div>
    </div>
  );
}

// ── Summary Tab ───────────────────────────────────────────────────────────────
function SummaryTab({ filters }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    setLoading(true); setErr("");
    reportsAPI.getSummary(filters)
      .then((r) => setData(r.data.data))
      .catch(() => setErr("Failed to load summary"))
      .finally(() => setLoading(false));
  }, [filters]);

  if (loading) return <LoadingState />;
  if (err) return <div className="alert alert-error">{err}</div>;
  if (!data) return null;

  const cards = [
    { label: "Total Required Periods", value: data.totalRequired,          color: "#4f46e5", icon: BookOpen },
    { label: "Scheduled Periods",      value: data.totalScheduled,         color: "#10b981", icon: CheckCircle },
    { label: "Unscheduled Periods",    value: data.totalUnscheduled,       color: "#ef4444", icon: AlertTriangle },
    { label: "Scheduling Rate",        value: data.schedulingRate + "%",   color: "#06b6d4", icon: BarChart2 },
    { label: "Hard Conflicts",         value: data.totalConflicts,         color: "#ef4444", icon: AlertTriangle },
    { label: "Soft Warnings",          value: data.totalWarnings,          color: "#f59e0b", icon: AlertTriangle },
    { label: "Active Faculty",         value: data.activeFaculty,          color: "#8b5cf6", icon: Users },
    { label: "Available Classrooms",   value: data.availableRooms,         color: "#14b8a6", icon: Building2 },
    { label: "Published Timetables",   value: data.publishedTimetables,    color: "#10b981", icon: CheckCircle },
  ];

  return (
    <div>
      <div className="summary-grid">
        {cards.map((c) => <StatCard key={c.label} {...c} />)}
      </div>
      <div className="card" style={{ marginTop: 8 }}>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
          <strong>Scope:</strong> {data.activeTimetablesInScope} timetable(s) in the selected filters.
          Scheduling rate is calculated as scheduled ÷ required periods × 100.
          Hard conflicts are unique constraint violations; soft warnings are scheduling quality issues.
          Archived timetables are excluded unless explicitly included via filters.
        </p>
      </div>
    </div>
  );
}

// ── Faculty Workload Tab ──────────────────────────────────────────────────────
function FacultyWorkloadTab({ filters }) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]       = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort]     = useState({ field: "weeklyHours", dir: "desc" });
  const [page, setPage]     = useState(1);

  const load = useCallback(() => {
    setLoading(true); setErr("");
    reportsAPI.getFacultyWorkload(filters)
      .then((r) => { setData(r.data.data); setPage(1); })
      .catch(() => setErr("Failed to load faculty workload"))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!data?.rows) return [];
    const q = search.toLowerCase();
    return data.rows.filter((r) =>
      !q || r.name.toLowerCase().includes(q) || r.employeeId.toLowerCase().includes(q)
    );
  }, [data, search]);

  const onSort = (field) => setSort((s) => ({ field, dir: s.field === field && s.dir === "asc" ? "desc" : "asc" }));
  const { paged, total } = useSortedPaged(filtered, sort, page);

  const statusBadge = (s) => {
    if (s === "Overloaded")          return "badge-danger";
    if (s === "At capacity")         return "badge-warning";
    if (s === "Within limit")        return "badge-success";
    return "badge-info";
  };

  const doExportCSV = () => exportCSV(
    "faculty_workload_report.csv",
    ["Name","Employee ID","Department","Classes","Weekly Hours","Subjects","Sections","Max Hours","Remaining","Status"],
    filtered.map((r) => [r.name, r.employeeId, r.department, r.classes, r.weeklyHours, r.subjectCount, r.sectionCount, r.maxWeeklyHours ?? "N/A", r.remainingCapacity ?? "N/A", r.workloadStatus])
  );

  const doExportPDF = () => exportPDF(
    "Faculty Workload Report",
    Object.entries(filters).filter(([,v]) => v).map(([k,v]) => `${k}=${v}`).join(", "),
    ["Name","Emp ID","Dept","Classes","Hrs/Wk","Subjects","Sections","Max Hrs","Status"],
    filtered.map((r) => [r.name, r.employeeId, r.department, r.classes, r.weeklyHours, r.subjectCount, r.sectionCount, r.maxWeeklyHours ?? "N/A", r.workloadStatus]),
    "faculty_workload_report.pdf"
  );

  if (loading) return <LoadingState />;
  if (err)     return <div className="alert alert-error">{err}</div>;
  if (!data)   return null;

  return (
    <div>
      {/* Chart */}
      {data.chartData?.length > 0 && (
        <div className="charts-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="chart-card">
            <h3>Teaching Hours by Faculty (Top 15)</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.chartData} margin={{ top: 5, right: 10, left: -20, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 10 }} unit="h" />
                <Tooltip formatter={(v, n) => [v + "h", n === "hours" ? "Scheduled" : "Max"]} />
                <Legend />
                <Bar dataKey="hours" name="Scheduled" fill="#4f46e5" radius={[3,3,0,0]} />
                <Bar dataKey="max"   name="Max Limit"  fill="#e0e7ff" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-card">
            <h3>Department Workload Summary</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.departmentSummary} margin={{ top: 5, right: 10, left: -20, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="department" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 10 }} unit="h" />
                <Tooltip />
                <Bar dataKey="avgHours" name="Avg Hours" fill="#06b6d4" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="table-container">
        <div className="table-toolbar">
          <div className="search-bar">
            <Search size={14} color="var(--text-secondary)" />
            <input placeholder="Search faculty name or ID…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={doExportCSV}><Download size={13} /> CSV</button>
            <button className="btn btn-secondary btn-sm" onClick={doExportPDF}><Download size={13} /> PDF</button>
          </div>
        </div>
        {paged.length === 0 ? <EmptyState title="No faculty found" message="Adjust filters or search." /> : (
          <>
            <table>
              <thead>
                <tr>
                  <SortTh label="Name"         field="name"          sort={sort} onSort={onSort} />
                  <SortTh label="Emp ID"        field="employeeId"    sort={sort} onSort={onSort} />
                  <SortTh label="Department"    field="department"    sort={sort} onSort={onSort} />
                  <SortTh label="Classes"       field="classes"       sort={sort} onSort={onSort} />
                  <SortTh label="Hrs/Week"      field="weeklyHours"   sort={sort} onSort={onSort} />
                  <th>Subjects</th><th>Sections</th>
                  <SortTh label="Max Hrs"       field="maxWeeklyHours"  sort={sort} onSort={onSort} />
                  <SortTh label="Remaining"     field="remainingCapacity" sort={sort} onSort={onSort} />
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r) => (
                  <tr key={r._id}>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td><span className="badge badge-cyan">{r.employeeId}</span></td>
                    <td>{r.department}</td>
                    <td>{r.classes}</td>
                    <td><strong>{r.weeklyHours}h</strong></td>
                    <td>{r.subjectCount}</td>
                    <td>{r.sectionCount}</td>
                    <td>{r.maxWeeklyHours != null ? r.maxWeeklyHours + "h" : "—"}</td>
                    <td>{r.remainingCapacity != null ? r.remainingCapacity + "h" : "—"}</td>
                    <td><span className={`badge ${statusBadge(r.workloadStatus)}`}>{r.workloadStatus}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} totalPages={Math.ceil(total / PAGE_SIZE)} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}

// ── Classroom Utilization Tab ────────────────────────────────────────────────
function ClassroomUtilizationTab({ filters }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");
  const [sort, setSort]       = useState({ field: "utilizationPct", dir: "desc" });
  const [page, setPage]       = useState(1);

  useEffect(() => {
    setLoading(true); setErr("");
    reportsAPI.getClassroomUtil(filters)
      .then((r) => { setData(r.data.data); setPage(1); })
      .catch(() => setErr("Failed to load classroom utilization"))
      .finally(() => setLoading(false));
  }, [filters]);

  const onSort = (field) => setSort((s) => ({ field, dir: s.field === field && s.dir === "asc" ? "desc" : "asc" }));
  const { paged, total } = useSortedPaged(data?.rows ?? [], sort, page);

  const doExportCSV = () => exportCSV(
    "classroom_utilization.csv",
    ["Room","Type","Capacity","Scheduled Hrs","Available Hrs","Utilization %"],
    (data?.rows ?? []).map((r) => [r.name, r.type, r.capacity, r.scheduledHours, r.availableHours, r.utilizationPct])
  );
  const doExportPDF = () => exportPDF(
    "Classroom Utilization Report",
    Object.entries(filters).filter(([,v]) => v).map(([k,v]) => `${k}=${v}`).join(", "),
    ["Room","Type","Capacity","Sched Hrs","Avail Hrs","Util %"],
    (data?.rows ?? []).map((r) => [r.name, r.type, r.capacity, r.scheduledHours, r.availableHours, r.utilizationPct + "%"]),
    "classroom_utilization.pdf"
  );

  if (loading) return <LoadingState />;
  if (err)     return <div className="alert alert-error">{err}</div>;
  if (!data)   return null;

  return (
    <div>
      {(data.barData?.length > 0 || data.typeData?.length > 0) && (
        <div className="charts-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          {data.barData?.length > 0 && (
            <div className="chart-card">
              <h3>Utilization % by Room (Top 15)</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.barData} margin={{ top: 5, right: 10, left: -20, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
                  <Tooltip formatter={(v) => [v + "%", "Utilization"]} />
                  <Bar dataKey="pct" name="Utilization" fill="#06b6d4" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {data.typeData?.length > 0 && (
            <div className="chart-card">
              <h3>Rooms by Type</h3>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={data.typeData} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={80} label={({ type, percent }) => `${type} ${(percent * 100).toFixed(0)}%`}>
                    {data.typeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
      <div className="table-container">
        <div className="table-toolbar">
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{total} classroom(s)</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={doExportCSV}><Download size={13} /> CSV</button>
            <button className="btn btn-secondary btn-sm" onClick={doExportPDF}><Download size={13} /> PDF</button>
          </div>
        </div>
        {paged.length === 0 ? <EmptyState title="No classrooms found" message="Adjust filters." /> : (
          <>
            <table>
              <thead>
                <tr>
                  <SortTh label="Room"          field="name"           sort={sort} onSort={onSort} />
                  <SortTh label="Type"          field="type"           sort={sort} onSort={onSort} />
                  <SortTh label="Capacity"      field="capacity"       sort={sort} onSort={onSort} />
                  <SortTh label="Sched Hrs"     field="scheduledHours" sort={sort} onSort={onSort} />
                  <SortTh label="Avail Hrs"     field="availableHours" sort={sort} onSort={onSort} />
                  <SortTh label="Utilization %" field="utilizationPct" sort={sort} onSort={onSort} />
                </tr>
              </thead>
              <tbody>
                {paged.map((r) => (
                  <tr key={r._id}>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td><span className="badge badge-cyan">{r.type}</span></td>
                    <td>{r.capacity}</td>
                    <td>{r.scheduledHours}h</td>
                    <td>{r.availableHours}h</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: "var(--border)", borderRadius: 3 }}>
                          <div style={{ width: `${r.utilizationPct}%`, height: "100%", background: r.utilizationPct >= 80 ? "#ef4444" : r.utilizationPct >= 50 ? "#f59e0b" : "#10b981", borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, minWidth: 36 }}>{r.utilizationPct}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} totalPages={Math.ceil(total / PAGE_SIZE)} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}

// ── Scheduling Completion Tab ─────────────────────────────────────────────────
function SchedulingCompletionTab({ filters }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");
  const [sort, setSort]       = useState({ field: "scheduledPct", dir: "desc" });
  const [page, setPage]       = useState(1);

  useEffect(() => {
    setLoading(true); setErr("");
    reportsAPI.getSchedulingCompletion(filters)
      .then((r) => { setData(r.data.data); setPage(1); })
      .catch(() => setErr("Failed to load scheduling completion"))
      .finally(() => setLoading(false));
  }, [filters]);

  const onSort = (field) => setSort((s) => ({ field, dir: s.field === field && s.dir === "asc" ? "desc" : "asc" }));
  const { paged, total } = useSortedPaged(data?.rows ?? [], sort, page);

  const statusBadge = (s) => {
    if (s === "Fully Scheduled")     return "badge-success";
    if (s === "Partially Scheduled") return "badge-warning";
    return "badge-danger";
  };

  const doExportCSV = () => exportCSV(
    "scheduling_completion.csv",
    ["Subject","Section","Department","Required","Scheduled","Unscheduled","Completion %","Status","Reason"],
    (data?.rows ?? []).map((r) => [r.subject, r.section, r.department, r.required, r.scheduled, r.unscheduled, r.scheduledPct, r.status, r.reason ?? ""])
  );
  const doExportPDF = () => exportPDF(
    "Scheduling Completion Report",
    Object.entries(filters).filter(([,v]) => v).map(([k,v]) => `${k}=${v}`).join(", "),
    ["Subject","Section","Dept","Req","Sched","Unsched","%","Status","Reason"],
    (data?.rows ?? []).map((r) => [r.subject, r.section, r.department, r.required, r.scheduled, r.unscheduled, r.scheduledPct + "%", r.status, r.reason ?? ""]),
    "scheduling_completion.pdf"
  );

  if (loading) return <LoadingState />;
  if (err)     return <div className="alert alert-error">{err}</div>;
  if (!data)   return null;

  return (
    <div>
      {data.deptChart?.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 16 }}>
          <h3>Completion % by Department</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.deptChart} margin={{ top: 5, right: 10, left: -20, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="department" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
              <Tooltip formatter={(v) => [v + "%", "Completion"]} />
              <Bar dataKey="pct" name="Completion" fill="#10b981" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="table-container">
        <div className="table-toolbar">
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{total} subject-section(s)</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={doExportCSV}><Download size={13} /> CSV</button>
            <button className="btn btn-secondary btn-sm" onClick={doExportPDF}><Download size={13} /> PDF</button>
          </div>
        </div>
        {paged.length === 0 ? <EmptyState title="No data found" message="Adjust filters." /> : (
          <>
            <table>
              <thead>
                <tr>
                  <SortTh label="Subject"    field="subject"      sort={sort} onSort={onSort} />
                  <SortTh label="Section"    field="section"      sort={sort} onSort={onSort} />
                  <SortTh label="Department" field="department"   sort={sort} onSort={onSort} />
                  <SortTh label="Required"   field="required"     sort={sort} onSort={onSort} />
                  <SortTh label="Scheduled"  field="scheduled"    sort={sort} onSort={onSort} />
                  <SortTh label="Unsched"    field="unscheduled"  sort={sort} onSort={onSort} />
                  <SortTh label="Completion" field="scheduledPct" sort={sort} onSort={onSort} />
                  <th>Status</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{r.subject}</td>
                    <td>{r.section}</td>
                    <td>{r.department}</td>
                    <td>{r.required}</td>
                    <td>{r.scheduled}</td>
                    <td>{r.unscheduled}</td>
                    <td><strong>{r.scheduledPct}%</strong></td>
                    <td><span className={`badge ${statusBadge(r.status)}`}>{r.status}</span></td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} totalPages={Math.ceil(total / PAGE_SIZE)} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}

// ── Conflicts Tab ─────────────────────────────────────────────────────────────
function ConflictsTab({ filters }) {
  const [data, setData]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [err, setErr]                 = useState("");
  const [revalId, setRevalId]         = useState("");
  const [revalMsg, setRevalMsg]       = useState("");
  const [revalLoading, setRevalLoading] = useState(false);
  const [typeFilter, setTypeFilter]   = useState("");
  const [sort, setSort]               = useState({ field: "severity", dir: "desc" });
  const [page, setPage]               = useState(1);

  const load = useCallback(() => {
    setLoading(true); setErr("");
    reportsAPI.getConflicts(filters)
      .then((r) => { setData(r.data.data); setPage(1); })
      .catch(() => setErr("Failed to load conflicts"))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!data?.rows) return [];
    return typeFilter ? data.rows.filter((r) => r.type === typeFilter) : data.rows;
  }, [data, typeFilter]);

  const onSort = (field) => setSort((s) => ({ field, dir: s.field === field && s.dir === "asc" ? "desc" : "asc" }));
  const { paged, total } = useSortedPaged(filtered, sort, page);

  const severityBadge = (s) => s === "error" ? "badge-danger" : "badge-warning";

  const doRevalidate = async () => {
    if (!revalId.trim()) return;
    setRevalLoading(true); setRevalMsg("");
    try {
      const r = await reportsAPI.revalidate(revalId.trim());
      setRevalMsg(`Revalidated: ${r.data.data.errorCount} error(s), ${r.data.data.warningCount} warning(s).`);
      load();
    } catch {
      setRevalMsg("Revalidation failed — check the timetable ID.");
    } finally {
      setRevalLoading(false);
    }
  };

  if (loading) return <LoadingState />;
  if (err)     return <div className="alert alert-error">{err}</div>;
  if (!data)   return null;

  const types = [...new Set((data.rows ?? []).map((r) => r.type))];

  return (
    <div>
      {data.pieData?.length > 0 && (
        <div className="charts-grid" style={{ gridTemplateColumns: "1fr 2fr", marginBottom: 16 }}>
          <div className="chart-card">
            <h3>Conflicts by Category</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data.pieData} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={75} label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}>
                  {data.pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-card" style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 12 }}>
            <h3>Revalidate a Timetable</h3>
            <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>Run live conflict detection on a specific timetable by its ID.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={revalId} onChange={(e) => setRevalId(e.target.value)} placeholder="Timetable ID…" style={{ flex: 1 }} />
              <button className="btn btn-primary btn-sm" onClick={doRevalidate} disabled={revalLoading}>
                <RefreshCw size={13} /> Revalidate
              </button>
            </div>
            {revalMsg && <div className="alert alert-info" style={{ marginTop: 0, padding: "6px 10px", fontSize: 12 }}>{revalMsg}</div>}
          </div>
        </div>
      )}
      <div className="table-container">
        <div className="table-toolbar">
          <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} style={{ fontSize: 12 }}>
            <option value="">All Types</option>
            {types.map((t) => <option key={t} value={t}>{CONFLICT_LABELS[t] ?? t}</option>)}
          </select>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{total} conflict(s)</span>
        </div>
        {paged.length === 0 ? <EmptyState title="No conflicts found" message="No constraint violations in the selected scope." /> : (
          <>
            <table>
              <thead>
                <tr>
                  <SortTh label="Type"     field="type"      sort={sort} onSort={onSort} />
                  <SortTh label="Severity" field="severity"  sort={sort} onSort={onSort} />
                  <th>Message</th>
                  <SortTh label="Day"      field="day"       sort={sort} onSort={onSort} />
                  <SortTh label="Time"     field="startTime" sort={sort} onSort={onSort} />
                  <th>Timetable</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r, i) => (
                  <tr key={i}>
                    <td><span className="badge badge-cyan">{CONFLICT_LABELS[r.type] ?? r.type}</span></td>
                    <td><span className={`badge ${severityBadge(r.severity)}`}>{r.severity}</span></td>
                    <td style={{ fontSize: 12 }}>{r.message}</td>
                    <td>{r.day ?? "—"}</td>
                    <td>{r.startTime ? `${r.startTime}–${r.endTime}` : "—"}</td>
                    <td style={{ fontSize: 11, color: "var(--text-secondary)" }}>{r.timetableId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} totalPages={Math.ceil(total / PAGE_SIZE)} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}

// ── Department Summary Tab ────────────────────────────────────────────────────
function DepartmentSummaryTab({ filters }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");
  const [sort, setSort]       = useState({ field: "schedulingRate", dir: "desc" });
  const [page, setPage]       = useState(1);

  useEffect(() => {
    setLoading(true); setErr("");
    reportsAPI.getDepartmentSummary(filters)
      .then((r) => { setData(r.data.data); setPage(1); })
      .catch(() => setErr("Failed to load department summary"))
      .finally(() => setLoading(false));
  }, [filters]);

  const onSort = (field) => setSort((s) => ({ field, dir: s.field === field && s.dir === "asc" ? "desc" : "asc" }));
  const { paged, total } = useSortedPaged(data?.rows ?? [], sort, page);

  if (loading) return <LoadingState />;
  if (err)     return <div className="alert alert-error">{err}</div>;
  if (!data)   return null;

  return (
    <div>
      {data.chartData?.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 16 }}>
          <h3>Scheduling Rate by Department</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.chartData} margin={{ top: 5, right: 10, left: -20, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="department" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
              <Tooltip formatter={(v) => [v + "%", "Scheduling Rate"]} />
              <Bar dataKey="rate" name="Rate" fill="#8b5cf6" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="table-container">
        <div className="table-toolbar">
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{total} department(s)</span>
        </div>
        {paged.length === 0 ? <EmptyState title="No departments found" message="Adjust filters." /> : (
          <>
            <table>
              <thead>
                <tr>
                  <SortTh label="Department"  field="department"    sort={sort} onSort={onSort} />
                  <SortTh label="Timetables"  field="timetables"    sort={sort} onSort={onSort} />
                  <SortTh label="Sections"    field="sections"      sort={sort} onSort={onSort} />
                  <SortTh label="Faculty"     field="faculty"       sort={sort} onSort={onSort} />
                  <SortTh label="Required"    field="required"      sort={sort} onSort={onSort} />
                  <SortTh label="Scheduled"   field="scheduled"     sort={sort} onSort={onSort} />
                  <SortTh label="Conflicts"   field="conflicts"     sort={sort} onSort={onSort} />
                  <SortTh label="Sched Rate"  field="schedulingRate" sort={sort} onSort={onSort} />
                </tr>
              </thead>
              <tbody>
                {paged.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{r.department}</td>
                    <td>{r.timetables}</td>
                    <td>{r.sections}</td>
                    <td>{r.faculty}</td>
                    <td>{r.required}</td>
                    <td>{r.scheduled}</td>
                    <td>{r.conflicts > 0 ? <span className="badge badge-danger">{r.conflicts}</span> : <span className="badge badge-success">0</span>}</td>
                    <td><strong>{r.schedulingRate}%</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} totalPages={Math.ceil(total / PAGE_SIZE)} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}

// ── Reports Page ──────────────────────────────────────────────────────────────
const TAB_COMPONENTS = [SummaryTab, FacultyWorkloadTab, ClassroomUtilizationTab, SchedulingCompletionTab, ConflictsTab, DepartmentSummaryTab];

export default function Reports() {
  const [activeTab, setActiveTab]     = useState(0);
  const [filters, setFilters]         = useState({ department: "", semester: "", academicYear: "", section: "", status: "published" });
  const [departments, setDepartments] = useState([]);
  const [sections, setSections]       = useState([]);
  const [timetables, setTimetables]   = useState([]);

  useEffect(() => {
    departmentsAPI.getAll().then((r) => setDepartments(r.data.data ?? [])).catch(() => {});
    sectionsAPI.getAll().then((r) => setSections(r.data.data ?? [])).catch(() => {});
    timetablesAPI.getAll().then((r) => setTimetables(r.data.data ?? [])).catch(() => {});
  }, []);

  const ActiveTab = TAB_COMPONENTS[activeTab];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Reports & Analytics</h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
          Insights across timetables, faculty workload, classroom usage, and scheduling quality.
        </p>
      </div>
      <FilterPanel
        filters={filters}
        setFilters={setFilters}
        departments={departments}
        sections={sections}
        facultyList={[]}
        classrooms={[]}
        timetables={timetables}
      />
      <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap", borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            style={{
              padding: "8px 16px", fontSize: 13, fontWeight: activeTab === i ? 700 : 400,
              background: "none", border: "none", cursor: "pointer",
              borderBottom: activeTab === i ? "2px solid var(--primary)" : "2px solid transparent",
              color: activeTab === i ? "var(--primary)" : "var(--text-secondary)",
              marginBottom: -1,
            }}
          >
            {tab}
          </button>
        ))}
      </div>
      <ActiveTab filters={filters} />
    </div>
  );
}
