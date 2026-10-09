import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bell, Search, Menu, ChevronDown, User, LogOut, KeyRound } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const titles = {
  "/": "Dashboard",
  "/subjects": "Subjects",
  "/faculty": "Faculty",
  "/classrooms": "Classrooms",
  "/departments": "Departments",
  "/sections": "Sections",
  "/working-days": "Working Days",
  "/time-slots": "Time Slots",
  "/timetable": "Generate Timetable",
  "/view-timetables": "View Timetables",
  "/users": "User Management",
  "/my-timetable": "My Timetable",
  "/my-class-timetable": "My Class Timetable",
  "/change-password": "Change Password",
};

const roleBadgeColor = { admin: "#4f46e5", faculty: "#06b6d4", student: "#10b981" };

export default function Navbar({ onMenuClick, searchValue, onSearchChange }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const title = titles[location.pathname] || "Dashboard";

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
    navigate("/login");
  };

  return (
    <header className="navbar">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button className="icon-btn sidebar-toggle" onClick={onMenuClick}><Menu size={20} /></button>
        <div className="navbar-left">
          <div className="navbar-title">{title}</div>
          <div className="navbar-breadcrumb">Home / {title}</div>
        </div>
      </div>

      <div className="navbar-right">
        <div className="navbar-search">
          <Search size={15} color="var(--text-secondary)" />
          <input placeholder="Search..." value={searchValue} onChange={(e) => onSearchChange(e.target.value)} />
        </div>

        <button className="icon-btn" title="Notifications">
          <Bell size={18} />
          <span className="notification-badge" />
        </button>

        <div style={{ position: "relative" }}>
          <button className="profile-btn" onClick={() => setDropdownOpen(!dropdownOpen)}>
            <div className="profile-avatar">{user?.name?.[0]?.toUpperCase() || "U"}</div>
            <div className="profile-info">
              <div className="profile-name">{user?.name || "User"}</div>
              <div className="profile-role" style={{ color: roleBadgeColor[user?.role] || "var(--text-secondary)" }}>
                {user?.role || ""}
              </div>
            </div>
            <ChevronDown size={14} color="var(--text-secondary)" />
          </button>

          {dropdownOpen && (
            <div className="profile-dropdown">
              <button onClick={() => { setDropdownOpen(false); navigate("/change-password"); }}>
                <KeyRound size={14} /> Change Password
              </button>
              <button className="danger" onClick={handleLogout}>
                <LogOut size={14} /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
