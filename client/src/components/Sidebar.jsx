import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, BookOpen, Users, Building2, GraduationCap, Layers,
  Calendar, Clock, CalendarRange, LogOut, X, KeyRound, UserCog, Eye, FolderKanban, BarChart2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const adminNav = [
  { to: "/",              label: "Dashboard",         icon: LayoutDashboard, end: true },
  { to: "/subjects",      label: "Subjects",           icon: BookOpen },
  { to: "/faculty",       label: "Faculty",            icon: Users },
  { to: "/classrooms",    label: "Classrooms",         icon: Building2 },
  { to: "/departments",   label: "Departments",        icon: GraduationCap },
  { to: "/sections",      label: "Sections",           icon: Layers },
  { to: "/working-days",  label: "Working Days",       icon: Calendar },
  { to: "/time-slots",    label: "Time Slots",         icon: Clock },
  { to: "/timetable",     label: "Generate Timetable", icon: CalendarRange },
  { to: "/view-timetables",    label: "View Timetables",      icon: Eye },
  { to: "/timetable-management", label: "Timetable Management", icon: FolderKanban },
  { to: "/reports",              label: "Reports & Analytics",  icon: BarChart2 },
  { to: "/users",                label: "User Management",      icon: UserCog },
];

const facultyNav = [
  { to: "/my-timetable",    label: "My Timetable",     icon: CalendarRange, end: true },
  { to: "/change-password", label: "Change Password",  icon: KeyRound },
];

const studentNav = [
  { to: "/my-class-timetable", label: "My Class Timetable", icon: CalendarRange, end: true },
  { to: "/change-password",    label: "Change Password",    icon: KeyRound },
];

export default function Sidebar({ isOpen, onClose }) {
  const { logout, user, isAdmin, isFaculty } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => { await logout(); navigate("/login"); };

  const navItems = isAdmin ? adminNav : isFaculty ? facultyNav : studentNav;
  const roleLabel = isAdmin ? "Admin Dashboard" : isFaculty ? "Faculty Portal" : "Student Portal";

  return (
    <>
      {isOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onClose}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 99 }}
        />
      )}
      <aside className={`sidebar ${isOpen ? "open" : ""}`}>
        <div className="sidebar-logo">
          <div className="logo-icon">ST</div>
          <div className="logo-text">Smart Timetable <span>{roleLabel}</span></div>
          <button
            onClick={onClose}
            className="sidebar-toggle icon-btn"
            style={{ marginLeft: "auto", color: "white", background: "transparent" }}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-title">Menu</div>
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <Icon size={18} />{label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            className="nav-item"
            style={{ width: "100%", background: "none", border: "none" }}
            onClick={handleLogout}
          >
            <LogOut size={18} /> Logout
          </button>
        </div>
      </aside>
    </>
  );
}
