require("dotenv").config();

const crypto = require("node:crypto");
const path = require("node:path");
const bcrypt = require("bcrypt");
const Database = require("better-sqlite3");
const express = require("express");
const session = require("express-session");

const app = express();
const port = Number(process.env.PORT) || 3000;
const demoMode = /^true$/i.test(process.env.DEMO_MODE || "false");
const dbPath = path.join(__dirname, "data", "faculty-attendance.sqlite");
require("node:fs").mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'faculty'))
  );
  CREATE TABLE IF NOT EXISTS faculty (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    faculty_id INTEGER NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late')),
    UNIQUE (faculty_id, date)
  );
`);

if (process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) {
  const existingAdmin = db.prepare("SELECT id FROM users WHERE username = ?")
    .get(process.env.ADMIN_USERNAME);
  if (!existingAdmin) {
    const passwordHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 12);
    db.prepare(
      "INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, 'admin')"
    ).run(process.env.ADMIN_USERNAME, passwordHash, process.env.ADMIN_USERNAME);
  }
}

app.use(express.json());
app.use(session({
  name: "faculty.sid",
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 8 * 60 * 60 * 1000
  }
}));

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Please sign in to continue." });
  }
  req.user = demoMode
    ? { ...req.session.user, role: "admin" }
    : req.session.user;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Administrator access is required." });
  }
  next();
}

function validDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

app.get("/api/config", (_req, res) => {
  res.json({ demoMode });
});

app.post("/api/login", (req, res, next) => {
  const username = typeof req.body.username === "string" ? req.body.username.trim() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  if (demoMode) {
    return req.session.regenerate((error) => {
      if (error) return next(error);
      req.session.user = {
        id: null,
        username,
        displayName: username,
        role: "admin"
      };
      req.session.save((saveError) => {
        if (saveError) return next(saveError);
        res.json({ username, displayName: username, role: "admin" });
      });
    });
  }

  const user = db.prepare(
    "SELECT id, username, password_hash, display_name, role FROM users WHERE username = ?"
  ).get(username);
  const passwordMatches = user
    ? bcrypt.compareSync(password, user.password_hash)
    : false;
  if (!passwordMatches) {
    return res.status(401).json({ error: "Incorrect username or password." });
  }

  req.session.regenerate((error) => {
    if (error) return next(error);
    req.session.user = {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role
    };
    req.session.save((saveError) => {
      if (saveError) return next(saveError);
      res.json({
        username: user.username,
        displayName: user.display_name,
        role: user.role
      });
    });
  });
});

app.post("/api/logout", (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie("faculty.sid", { httpOnly: true, sameSite: "lax" });
    res.json({ success: true });
  });
});

app.get("/api/me", requireAuth, (req, res) => {
  res.json({
    username: req.user.username,
    displayName: req.user.displayName,
    role: req.user.role
  });
});

app.get("/api/faculty", requireAuth, requireAdmin, (_req, res) => {
  res.json(db.prepare("SELECT id, name, department, email FROM faculty ORDER BY name").all());
});

app.post("/api/faculty", requireAuth, requireAdmin, (req, res) => {
  const { name, department, email } = req.body;
  if (![name, department, email].every((value) => typeof value === "string" && value.trim())) {
    return res.status(400).json({ error: "Name, department, and email are required." });
  }
  try {
    const result = db.prepare(
      "INSERT INTO faculty (name, department, email) VALUES (?, ?, ?)"
    ).run(name.trim(), department.trim(), email.trim());
    res.status(201).json(db.prepare(
      "SELECT id, name, department, email FROM faculty WHERE id = ?"
    ).get(result.lastInsertRowid));
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ error: "A faculty member with that email already exists." });
    }
    throw error;
  }
});

app.put("/api/faculty/:id", requireAuth, requireAdmin, (req, res) => {
  const { name, department, email } = req.body;
  if (![name, department, email].every((value) => typeof value === "string" && value.trim())) {
    return res.status(400).json({ error: "Name, department, and email are required." });
  }
  try {
    const result = db.prepare(
      "UPDATE faculty SET name = ?, department = ?, email = ? WHERE id = ?"
    ).run(name.trim(), department.trim(), email.trim(), req.params.id);
    if (!result.changes) return res.status(404).json({ error: "Faculty member not found." });
    res.json(db.prepare(
      "SELECT id, name, department, email FROM faculty WHERE id = ?"
    ).get(req.params.id));
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ error: "A faculty member with that email already exists." });
    }
    throw error;
  }
});

app.delete("/api/faculty/:id", requireAuth, requireAdmin, (req, res) => {
  const result = db.prepare("DELETE FROM faculty WHERE id = ?").run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: "Faculty member not found." });
  res.json({ success: true });
});

app.get("/api/attendance", requireAuth, requireAdmin, (req, res) => {
  const date = req.query.date;
  if (date && !validDate(date)) return res.status(400).json({ error: "Date must use YYYY-MM-DD." });
  const rows = db.prepare(`
    SELECT f.id AS facultyId, f.name, f.department, f.email,
           a.status, a.date
    FROM faculty f
    LEFT JOIN attendance a ON a.faculty_id = f.id AND a.date = ?
    ORDER BY f.name
  `).all(date || new Date().toISOString().slice(0, 10));
  res.json(rows);
});

app.post("/api/attendance", requireAuth, requireAdmin, (req, res) => {
  const { facultyId, date, status } = req.body;
  if (!Number.isInteger(Number(facultyId)) || !validDate(date)
      || !["present", "absent", "late"].includes(status)) {
    return res.status(400).json({ error: "A faculty member, valid date, and attendance status are required." });
  }
  const facultyMember = db.prepare("SELECT id FROM faculty WHERE id = ?").get(facultyId);
  if (!facultyMember) return res.status(404).json({ error: "Faculty member not found." });
  db.prepare(`
    INSERT INTO attendance (faculty_id, date, status) VALUES (?, ?, ?)
    ON CONFLICT(faculty_id, date) DO UPDATE SET status = excluded.status
  `).run(facultyId, date, status);
  res.json({ success: true });
});

app.get("/api/reports", requireAuth, requireAdmin, (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  if (typeof month !== "string" || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: "Month must use YYYY-MM." });
  }
  const rows = db.prepare(`
    SELECT f.id AS facultyId, f.name, f.department,
      SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present,
      SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) AS absent,
      SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) AS late
    FROM faculty f
    LEFT JOIN attendance a ON a.faculty_id = f.id AND substr(a.date, 1, 7) = ?
    GROUP BY f.id
    ORDER BY f.name
  `).all(month);
  res.json({ month, rows });
});

function csvCell(value) {
  let safeValue = String(value == null ? "" : value);
  if (/^[=+\-@\t\r]/.test(safeValue)) safeValue = `'${safeValue}`;
  return `"${safeValue.replace(/"/g, '""')}"`;
}

app.get("/api/reports/export.csv", requireAuth, requireAdmin, (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  if (typeof month !== "string" || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: "Month must use YYYY-MM." });
  }
  const rows = db.prepare(`
    SELECT f.name, f.department, a.date, a.status
    FROM attendance a JOIN faculty f ON f.id = a.faculty_id
    WHERE substr(a.date, 1, 7) = ?
    ORDER BY a.date, f.name
  `).all(month);
  const csv = [
    ["Faculty", "Department", "Date", "Status"].map(csvCell).join(","),
    ...rows.map((row) => [row.name, row.department, row.date, row.status].map(csvCell).join(","))
  ].join("\r\n");
  res.type("text/csv; charset=utf-8");
  res.attachment(`attendance-${month}.csv`);
  res.send(csv);
});

app.use(express.static(path.join(__dirname, "public")));
app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "public", "login.html")));

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "An unexpected server error occurred." });
});

app.listen(port, () => {
  console.log(`Faculty Attendance demo listening on http://localhost:${port}`);
  console.log(`Demo mode: ${demoMode ? "on" : "off"}`);
});
