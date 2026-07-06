// backend/index.js
// Express server for the Student Registration app.
// Connects to data.db (SQLite) using better-sqlite3.

const express = require('express');
const cors = require('cors'); // npm install cors (if not already installed)
const Database = require('better-sqlite3');

const app = express();
app.use(cors()); // allow the frontend (different port) to call this API
app.use(express.json()); // parse JSON request bodies

// Connect to (or create) the database file
const db = new Database('data.db');

// Create the students table if it doesn't already exist
db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    course TEXT NOT NULL,
    registered_at TEXT NOT NULL
  )
`);

// ---------- CREATE ----------
// Register a new student
app.post('/students', (req, res) => {
  const { name, email, phone, course } = req.body;

  if (!name || !email || !course) {
    return res.status(400).json({ error: 'name, email, and course are required' });
  }

  const existing = db.prepare('SELECT id FROM students WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'A student with this email is already registered' });
  }

  const registered_at = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO students (name, email, phone, course, registered_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const info = stmt.run(name, email, phone || '', course, registered_at);

  res.status(201).json({ id: info.lastInsertRowid, name, email, phone, course, registered_at });
});

// ---------- READ (all students, paginated + optional search) ----------
// GET /students?page=1&limit=5&search=john
app.get('/students', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 5;
  const offset = (page - 1) * limit;
  const search = req.query.search ? `%${req.query.search}%` : '%';

  const totalRow = db
    .prepare('SELECT COUNT(*) as count FROM students WHERE name LIKE ? OR course LIKE ?')
    .get(search, search);
  const total = totalRow.count;

  const rows = db
    .prepare(
      `SELECT * FROM students
       WHERE name LIKE ? OR course LIKE ?
       ORDER BY registered_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(search, search, limit, offset);

  res.json({
    data: rows,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
});

// ---------- READ (single student by id) ----------
app.get('/students/:id', (req, res) => {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  res.json(student);
});

// ---------- UPDATE ----------
app.put('/students/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM students WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Student not found' });

  const name = req.body.name ?? existing.name;
  const email = req.body.email ?? existing.email;
  const phone = req.body.phone ?? existing.phone;
  const course = req.body.course ?? existing.course;

  db.prepare('UPDATE students SET name = ?, email = ?, phone = ?, course = ? WHERE id = ?').run(
    name,
    email,
    phone,
    course,
    id
  );

  res.json({ ...existing, name, email, phone, course });
});

// ---------- DELETE ----------
app.delete('/students/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM students WHERE id = ?').run(id);
  res.json({ message: `Student ${id} deleted` });
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
