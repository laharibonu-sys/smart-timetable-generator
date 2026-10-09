const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db");
const errorHandler = require("./middleware/errorHandler");

// Ensure all models are registered before routes use them
require("./models/AuditLog");

connectDB();

const app = express();

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());

// Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/departments", require("./routes/departmentRoutes"));
app.use("/api/subjects", require("./routes/subjectRoutes"));
app.use("/api/faculty", require("./routes/facultyRoutes"));
app.use("/api/classrooms", require("./routes/classroomRoutes"));
app.use("/api/sections", require("./routes/sectionRoutes"));
app.use("/api/working-days", require("./routes/workingDayRoutes"));
app.use("/api/time-slots", require("./routes/timeSlotRoutes"));
app.use("/api/dashboard", require("./routes/dashboardRoutes"));
app.use("/api/timetables", require("./routes/timetableRoutes"));
app.use("/api/reports",    require("./routes/reportRoutes"));

app.get("/", (req, res) => res.json({ message: "Smart Timetable Generator API is running!" }));

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
