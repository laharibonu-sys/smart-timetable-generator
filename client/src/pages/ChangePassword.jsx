import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { KeyRound } from "lucide-react";

export default function ChangePassword() {
  const { changePassword } = useAuth();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [status, setStatus] = useState(null); // { type: "success"|"error", message }
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus(null);
    if (!form.currentPassword || !form.newPassword || !form.confirmPassword)
      return setStatus({ type: "error", message: "All fields are required" });
    if (form.newPassword.length < 6)
      return setStatus({ type: "error", message: "New password must be at least 6 characters" });
    if (form.newPassword !== form.confirmPassword)
      return setStatus({ type: "error", message: "New passwords do not match" });

    setLoading(true);
    try {
      await changePassword(form.currentPassword, form.newPassword);
      setStatus({ type: "success", message: "Password changed successfully" });
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setStatus({ type: "error", message: err.response?.data?.message || "Failed to change password" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Change Password</h1>
      </div>
      <div className="card" style={{ maxWidth: 480 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <KeyRound size={20} color="var(--primary)" />
          <span style={{ fontWeight: 600 }}>Update your password</span>
        </div>

        {status && (
          <div className={`alert alert-${status.type === "success" ? "success" : "error"}`} style={{ marginBottom: 16 }}>
            {status.message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Current Password</label>
            <input
              type="password"
              value={form.currentPassword}
              onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
              autoComplete="current-password"
            />
          </div>
          <div className="form-group">
            <label>New Password</label>
            <input
              type="password"
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
              autoComplete="new-password"
            />
          </div>
          <div className="form-group">
            <label>Confirm New Password</label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              autoComplete="new-password"
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
