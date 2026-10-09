import axios from "axios";

const api = axios.create({ baseURL: "http://localhost:5000/api" });

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// Auth
export const authAPI = {
  login:          (data) => api.post("/auth/login", data),
  logout:         ()     => api.post("/auth/logout"),
  getMe:          ()     => api.get("/auth/me"),
  changePassword: (data) => api.post("/auth/change-password", data),
  // Admin-only user management
  listUsers:      ()     => api.get("/auth/users"),
  createUser:     (data) => api.post("/auth/register", data),
  updateUser:     (id, data) => api.patch(`/auth/users/${id}`, data),
};

// Dashboard
export const dashboardAPI = {
  getStats:         () => api.get("/dashboard/stats"),
  getCharts:        () => api.get("/dashboard/charts"),
  getRecentActivity:() => api.get("/dashboard/recent-activity"),
};

// Generic CRUD factory
const crudAPI = (resource) => ({
  getAll:  (params) => api.get(`/${resource}`, { params }),
  getOne:  (id)     => api.get(`/${resource}/${id}`),
  create:  (data)   => api.post(`/${resource}`, data),
  update:  (id, data) => api.put(`/${resource}/${id}`, data),
  remove:  (id)     => api.delete(`/${resource}/${id}`),
});

export const departmentsAPI  = crudAPI("departments");
export const subjectsAPI     = crudAPI("subjects");
export const facultyAPI      = crudAPI("faculty");
export const classroomsAPI   = crudAPI("classrooms");
export const sectionsAPI     = crudAPI("sections");
export const timeSlotsAPI    = crudAPI("time-slots");
export const workingDaysAPI  = {
  ...crudAPI("working-days"),
  bulkUpdate: (days) => api.put("/working-days/bulk", { days }),
};

export const reportsAPI = {
  getSummary:             (params) => api.get("/reports/summary",                { params }),
  getFacultyWorkload:     (params) => api.get("/reports/faculty-workload",       { params }),
  getClassroomUtil:       (params) => api.get("/reports/classroom-utilization",  { params }),
  getSchedulingCompletion:(params) => api.get("/reports/scheduling-completion",  { params }),
  getConflicts:           (params) => api.get("/reports/conflicts",              { params }),
  getDepartmentSummary:   (params) => api.get("/reports/department-summary",     { params }),
  revalidate:             (id)     => api.post(`/reports/revalidate/${id}`),
};

export const timetablesAPI = {
  generate:        (data)            => api.post("/timetables/generate", data),
  getAll:          (params)          => api.get("/timetables", { params }),
  getOne:          (id)              => api.get(`/timetables/${id}`),
  validate:        (id)              => api.post(`/timetables/${id}/validate`),
  checkEntry:      (data)            => api.post("/timetables/check-entry", data),
  publish:         (id)              => api.patch(`/timetables/${id}/publish`),
  archive:         (id)              => api.patch(`/timetables/${id}/archive`),
  restore:         (id)              => api.patch(`/timetables/${id}/restore`),
  regenerate:      (id)              => api.post(`/timetables/${id}/regenerate`),
  editAssignment:  (id, aId, data)   => api.patch(`/timetables/${id}/assignments/${aId}`, data),
  exportCSVUrl:    (id)              => `http://localhost:5000/api/timetables/${id}/export/csv`,
  getAuditLog:     (id)              => api.get(`/timetables/${id}/audit`),
  remove:          (id)              => api.delete(`/timetables/${id}`),
  getReadiness:    (params)          => api.get("/timetables/readiness", { params }),
  getMySchedule:   (params)          => api.get("/timetables/my-schedule", { params }),
  getMySection:    (params)          => api.get("/timetables/my-section", { params }),
  viewTimetables:  (params)          => api.get("/timetables/view", { params }),
};

export default api;
