import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Users, Building2, GraduationCap, Layers, Clock, Calendar, Plus, TrendingUp, CalendarRange } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { dashboardAPI, timetablesAPI } from "../services/api";
import { LoadingState, EmptyState } from "../components/States";

const COLORS = ["#4f46e5", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

const summaryConfig = [
  { key: "subjects",    label: "Total Subjects",    icon: BookOpen,      color: "#4f46e5", bg: "#e0e7ff", to: "/subjects" },
  { key: "faculty",     label: "Total Faculty",     icon: Users,         color: "#06b6d4", bg: "#ecfeff", to: "/faculty" },
  { key: "classrooms",  label: "Total Classrooms",  icon: Building2,     color: "#10b981", bg: "#ecfdf5", to: "/classrooms" },
  { key: "departments", label: "Departments",        icon: GraduationCap, color: "#f59e0b", bg: "#fffbeb", to: "/departments" },
  { key: "sections",    label: "Total Sections",    icon: Layers,        color: "#8b5cf6", bg: "#f5f3ff", to: "/sections" },
  { key: "timeSlots",   label: "Active Time Slots", icon: Clock,         color: "#ef4444", bg: "#fef2f2", to: "/time-slots" },
  { key: "workingDays", label: "Working Days",       icon: Calendar,      color: "#ec4899", bg: "#fdf2f8", to: "/working-days" },
];

const quickActions = [
  { label: "Add Subject", to: "/subjects", color: "#4f46e5", bg: "#e0e7ff", icon: BookOpen },
  { label: "Add Faculty", to: "/faculty", color: "#06b6d4", bg: "#ecfeff", icon: Users },
  { label: "Add Classroom", to: "/classrooms", color: "#10b981", bg: "#ecfdf5", icon: Building2 },
  { label: "Add Department", to: "/departments", color: "#f59e0b", bg: "#fffbeb", icon: GraduationCap },
  { label: "Add Section", to: "/sections", color: "#8b5cf6", bg: "#f5f3ff", icon: Layers },
  { label: "Time Slots", to: "/time-slots", color: "#ef4444", bg: "#fef2f2", icon: Clock },
];

const activityColors = { Subject: "#4f46e5", Faculty: "#06b6d4", Classroom: "#10b981", Department: "#f59e0b" };

function timeAgo(date) {
  const diff = (Date.now() - new Date(date)) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [charts, setCharts] = useState(null);
  const [activity, setActivity] = useState([]);
  const [ttCounts, setTtCounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      dashboardAPI.getStats(),
      dashboardAPI.getCharts(),
      dashboardAPI.getRecentActivity(),
      timetablesAPI.getAll(),
    ])
      .then(([s, c, a, tt]) => {
        setStats(s.data.data);
        setCharts(c.data.data);
        setActivity(a.data.data);
        setTtCounts(tt.data.counts);
      })
      .catch(() => setError("Failed to load dashboard data. Please refresh."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading dashboard..." />;
  if (error) return <EmptyState title="Error" message={error} />;

  return (
    <div>
      {/* Summary Cards */}
      <div className="summary-grid">
        {summaryConfig.map(({ key, label, icon: Icon, color, bg, to }) => (
          <div key={key} className="summary-card" style={{ borderLeftColor: color, cursor: "pointer" }} onClick={() => navigate(to)}>
            <div className="summary-icon" style={{ background: bg }}>
              <Icon size={22} color={color} />
            </div>
            <div className="summary-info">
              <div className="count">{stats?.[key] ?? 0}</div>
              <div className="label">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Timetable Stats */}
      {ttCounts && (
        <div className="summary-grid" style={{ marginBottom: 0 }}>
          {[
            { label: "Total Timetables", value: ttCounts.total,     color: "#4f46e5", to: "/timetable-management" },
            { label: "Drafts",           value: ttCounts.draft,     color: "#f59e0b", to: "/timetable-management" },
            { label: "Published",        value: ttCounts.published, color: "#10b981", to: "/timetable-management" },
            { label: "Archived",         value: ttCounts.archived,  color: "#64748b", to: "/timetable-management" },
          ].map(({ label, value, color, to }) => (
            <div key={label} className="summary-card" style={{ borderLeftColor: color, cursor: "pointer" }} onClick={() => navigate(to)}>
              <div className="summary-icon" style={{ background: color + "22" }}>
                <CalendarRange size={22} color={color} />
              </div>
              <div className="summary-info">
                <div className="count">{value ?? 0}</div>
                <div className="label">{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      <div className="charts-grid">
        <div className="chart-card">
          <h3><TrendingUp size={16} style={{ display: "inline", marginRight: 6 }} />Faculty by Department</h3>
          {charts?.facultyByDept?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={charts.facultyByDept} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState title="No data yet" message="Add faculty and departments to see this chart." />}
        </div>

        <div className="chart-card">
          <h3>Classrooms by Type</h3>
          {charts?.classroomsByType?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={charts.classroomsByType} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {charts.classroomsByType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyState title="No data yet" message="Add classrooms to see this chart." />}
        </div>

        <div className="chart-card">
          <h3>Subjects by Department</h3>
          {charts?.subjectsByDept?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={charts.subjectsByDept} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState title="No data yet" message="Add subjects and departments to see this chart." />}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        {/* Recent Activity */}
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Recent Activity</h3>
          {activity.length > 0 ? (
            <div className="activity-list">
              {activity.map((item, i) => (
                <div key={i} className="activity-item">
                  <div className="activity-dot" style={{ background: activityColors[item.type] || "#94a3b8" }} />
                  <div className="activity-info">
                    <div className="activity-label">{item.label}</div>
                    <div className="activity-type">{item.type} added</div>
                  </div>
                  <div className="activity-time">{timeAgo(item.time)}</div>
                </div>
              ))}
            </div>
          ) : <EmptyState title="No recent activity" message="Records you add will appear here." />}
        </div>

        {/* Quick Actions */}
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Quick Actions</h3>
          <div className="quick-actions-grid">
            {quickActions.map(({ label, to, color, bg, icon: Icon }) => (
              <button key={to} className="quick-action-btn" onClick={() => navigate(to)}>
                <div className="qa-icon" style={{ background: bg }}><Icon size={20} color={color} /></div>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
