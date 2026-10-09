import { useEffect, useState } from "react";
import { authAPI, facultyAPI, sectionsAPI } from "../services/api";
import { Plus, UserCheck, UserX, Pencil } from "lucide-react";

const ROLES = ["admin", "faculty", "student"];
const roleBadge = { admin: "badge-purple", faculty: "badge-info", student: "badge-success" };

function UserFormModal({ onClose, onSaved, facultyList, sectionList, editUser }) {
  const isEdit = !!editUser;
  const [form, setForm] = useState(
    isEdit
      ? { name: editUser.name, role: editUser.role, facultyRef: editUser.facultyRef || "", sectionRef: editUser.sectionRef || "", isActive: editUser.isActive }
      : { name: "", email: "", password: "", role: "faculty", facultyRef: "", sectionRef: "" }
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name) return setError("Name is required");
    if (!isEdit && (!form.email || !form.password)) return setError("Email and password are required");
    if (!isEdit && form.password.length < 6) return setError("Password must be at least 6 characters");
    setLoading(true);
    try {
      if (isEdit) {
        await authAPI.updateUser(editUser._id, {
          name: form.name,
          role: form.role,
          isActive: form.isActive,
          facultyRef: form.role === "faculty" && form.facultyRef ? form.facultyRef : null,
          sectionRef: form.role === "student" && form.sectionRef ? form.sectionRef : null,
        });
      } else {
        await authAPI.createUser({
          name: form.name, email: form.email, password: form.password, role: form.role,
          facultyRef: form.role === "faculty" && form.facultyRef ? form.facultyRef : undefined,
          sectionRef: form.role === "student" && form.sectionRef ? form.sectionRef : undefined,
        });
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save user");
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2>{isEdit ? "Edit User" : "Create User Account"}</h2>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-group">
            <label>Full Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          {!isEdit && (
            <>
              <div className="form-group">
                <label>Email *</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Password *</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
            </>
          )}
          <div className="form-group">
            <label>Role</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value, facultyRef: "", sectionRef: "" })}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {form.role === "faculty" && (
            <div className="form-group">
              <label>Link to Faculty Profile (optional)</label>
              <select value={form.facultyRef} onChange={(e) => setForm({ ...form, facultyRef: e.target.value })}>
                <option value="">— Select faculty —</option>
                {facultyList.map((f) => <option key={f._id} value={f._id}>{f.name} ({f.employeeId})</option>)}
              </select>
            </div>
          )}
          {form.role === "student" && (
            <div className="form-group">
              <label>Link to Section</label>
              <select value={form.sectionRef} onChange={(e) => setForm({ ...form, sectionRef: e.target.value })}>
                <option value="">— Select section —</option>
                {sectionList.map((s) => <option key={s._id} value={s._id}>{s.name} · Sem {s.semester} · {s.academicYear}</option>)}
              </select>
            </div>
          )}
          {isEdit && (
            <div className="form-check">
              <input type="checkbox" id="userActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              <label htmlFor="userActive">Active</label>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving..." : isEdit ? "Save Changes" : "Create Account"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [sectionList, setSectionList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalUser, setModalUser] = useState(null); // null = closed, false = create, object = edit

  const load = async () => {
    setLoading(true);
    try {
      const [uRes, fRes, sRes] = await Promise.all([authAPI.listUsers(), facultyAPI.getAll(), sectionsAPI.getAll()]);
      setUsers(uRes.data.users);
      setFacultyList(fRes.data.data || []);
      setSectionList(sRes.data.data || []);
    } catch { }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (u) => {
    try {
      await authAPI.updateUser(u._id, { isActive: !u.isActive });
      setUsers((prev) => prev.map((x) => x._id === u._id ? { ...x, isActive: !x.isActive } : x));
    } catch { }
  };

  return (
    <div>
      <div className="page-header">
        <h1>User Management</h1>
        <button className="btn btn-primary" onClick={() => setModalUser(false)}>
          <Plus size={16} /> New User
        </button>
      </div>

      {modalUser !== null && (
        <UserFormModal
          facultyList={facultyList}
          sectionList={sectionList}
          editUser={modalUser || null}
          onClose={() => setModalUser(null)}
          onSaved={() => { setModalUser(null); load(); }}
        />
      )}

      <div className="table-container">
        <table>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Linked To</th><th>Status</th><th>Created</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 32, color: "var(--text-secondary)" }}>Loading...</td></tr>
            ) : users.map((u) => (
              <tr key={u._id}>
                <td style={{ fontWeight: 600 }}>{u.name}</td>
                <td>{u.email}</td>
                <td><span className={`badge ${roleBadge[u.role] || "badge-info"}`}>{u.role}</span></td>
                <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {u.facultyRef ? `Faculty: ${u.facultyRef}` : u.sectionRef ? `Section: ${u.sectionRef}` : "—"}
                </td>
                <td><span className={`badge ${u.isActive ? "badge-success" : "badge-danger"}`}>{u.isActive ? "Active" : "Inactive"}</span></td>
                <td style={{ color: "var(--text-secondary)", fontSize: 12 }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                <td>
                  <div className="table-actions">
                    <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setModalUser(u)} title="Edit">
                      <Pencil size={13} />
                    </button>
                    <button
                      className={`btn btn-sm ${u.isActive ? "btn-danger" : "btn-success"}`}
                      onClick={() => toggleActive(u)}
                    >
                      {u.isActive ? <UserX size={13} /> : <UserCheck size={13} />}
                      {u.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
