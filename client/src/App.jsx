import { useState, Component } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import Subjects from "./pages/Subjects";
import Faculty from "./pages/Faculty";
import Classrooms from "./pages/Classrooms";
import Departments from "./pages/Departments";
import Sections from "./pages/Sections";
import WorkingDays from "./pages/WorkingDays";
import TimeSlots from "./pages/TimeSlots";
import Timetable from "./pages/Timetable";
import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";
import FacultyTimetable from "./pages/FacultyTimetable";
import StudentTimetable from "./pages/StudentTimetable";
import TimetableManagement from "./pages/TimetableManagement";
import ViewTimetables from "./pages/ViewTimetables";
import UserManagement from "./pages/UserManagement";
import Reports from "./pages/Reports";
import { LoadingState } from "./components/States";
import "./styles/global.css";

class ErrorBoundary extends Component {
  state = { crashed: false };
  static getDerivedStateFromError() { return { crashed: true }; }
  render() {
    if (this.state.crashed) {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 12, fontFamily: "inherit" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Something went wrong</h2>
          <p style={{ color: "#64748b", fontSize: 14 }}>An unexpected error occurred.</p>
          <button
            onClick={() => { this.setState({ crashed: false }); window.location.href = "/"; }}
            style={{ padding: "8px 20px", background: "#4f46e5", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 }}
          >
            Go to Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Redirect to the correct home page based on role
function RoleHome() {
  const { user } = useAuth();
  if (user?.role === "student") return <StudentTimetable />;
  if (user?.role === "faculty") return <FacultyTimetable />;
  return <Dashboard />;
}

// Only renders children if user has one of the allowed roles; otherwise redirects
function RoleRoute({ roles, children }) {
  const { user } = useAuth();
  if (!roles.includes(user?.role)) return <Navigate to="/" replace />;
  return children;
}

function ProtectedLayout() {
  const { user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");

  if (loading) return <LoadingState message="Authenticating..." />;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="app-layout">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <Navbar onMenuClick={() => setSidebarOpen(true)} searchValue={search} onSearchChange={setSearch} />
        <main className="page-content">
          <Routes>
            {/* Shared */}
            <Route path="/" element={<RoleHome />} />
            <Route path="/change-password" element={<ChangePassword />} />
            <Route path="/my-timetable" element={<RoleRoute roles={["faculty"]}><FacultyTimetable /></RoleRoute>} />
            <Route path="/my-class-timetable" element={<RoleRoute roles={["student"]}><StudentTimetable /></RoleRoute>} />

            {/* Admin-only */}
            <Route path="/subjects"     element={<RoleRoute roles={["admin"]}><Subjects /></RoleRoute>} />
            <Route path="/faculty"      element={<RoleRoute roles={["admin"]}><Faculty /></RoleRoute>} />
            <Route path="/classrooms"   element={<RoleRoute roles={["admin"]}><Classrooms /></RoleRoute>} />
            <Route path="/departments"  element={<RoleRoute roles={["admin"]}><Departments /></RoleRoute>} />
            <Route path="/sections"     element={<RoleRoute roles={["admin"]}><Sections /></RoleRoute>} />
            <Route path="/working-days" element={<RoleRoute roles={["admin"]}><WorkingDays /></RoleRoute>} />
            <Route path="/time-slots"   element={<RoleRoute roles={["admin"]}><TimeSlots /></RoleRoute>} />
            <Route path="/timetable"    element={<RoleRoute roles={["admin"]}><Timetable /></RoleRoute>} />
            <Route path="/view-timetables"      element={<RoleRoute roles={["admin"]}><ViewTimetables /></RoleRoute>} />
            <Route path="/timetable-management" element={<RoleRoute roles={["admin"]}><TimetableManagement /></RoleRoute>} />
            <Route path="/users"                element={<RoleRoute roles={["admin"]}><UserManagement /></RoleRoute>} />
            <Route path="/reports"              element={<RoleRoute roles={["admin"]}><Reports /></RoleRoute>} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function PublicRoute() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState message="Loading..." />;
  if (user) return <Navigate to="/" replace />;
  return <Login />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <Routes>
            <Route path="/login" element={<PublicRoute />} />
            <Route path="/*" element={<ProtectedLayout />} />
          </Routes>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}
