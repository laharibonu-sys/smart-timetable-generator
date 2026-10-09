import { createContext, useContext, useState, useEffect } from "react";
import { authAPI } from "../services/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount: verify token with server (never trust localStorage alone)
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { setLoading(false); return; }

    authAPI.getMe()
      .then((res) => setUser(res.data.user))
      .catch(() => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await authAPI.login({ email, password });
    localStorage.setItem("token", res.data.token);
    localStorage.setItem("user", JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data;
  };

  const logout = async () => {
    try { await authAPI.logout(); } catch { /* ignore */ }
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  const changePassword = (currentPassword, newPassword) =>
    authAPI.changePassword({ currentPassword, newPassword });

  const isAdmin   = user?.role === "admin";
  const isFaculty = user?.role === "faculty";
  const isStudent = user?.role === "student";

  return (
    <AuthContext.Provider value={{ user, login, logout, changePassword, loading, isAdmin, isFaculty, isStudent }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
