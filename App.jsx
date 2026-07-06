// frontend/src/App.jsx
import { useState, useEffect } from 'react';
import './App.css';

const API_URL = 'http://localhost:5000';
const PAGE_LIMIT = 5;

function App() {
  // ---------- Registration form state ----------
  const [form, setForm] = useState({ name: '', email: '', phone: '', course: '' });
  const [editingId, setEditingId] = useState(null); // set when editing an existing student
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // ---------- Student list state ----------
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // ---------- Dark mode ----------
  const [darkMode, setDarkMode] = useState(false);

  // Fetch one page of students, optionally filtered by search text
  const fetchStudents = async (pageToLoad = page, searchTerm = search) => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/students?page=${pageToLoad}&limit=${PAGE_LIMIT}&search=${encodeURIComponent(
          searchTerm
        )}`
      );
      const data = await res.json();
      setStudents(data.data);
      setTotalPages(data.totalPages);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to load students', err);
    }
    setLoading(false);
  };

  // Load the first page on mount
  useEffect(() => {
    fetchStudents(1, '');
  }, []);

  // Reload whenever the page changes
  useEffect(() => {
    fetchStudents(page, search);
  }, [page]);

  // Handle typing in the form fields
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Create a new student, or update one if editingId is set
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!form.name.trim() || !form.email.trim() || !form.course.trim()) {
      setFormError('Name, email, and course are required.');
      return;
    }

    setSaving(true);
    try {
      const url = editingId ? `${API_URL}/students/${editingId}` : `${API_URL}/students`;
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const errData = await res.json();
        setFormError(errData.error || 'Something went wrong.');
        setSaving(false);
        return;
      }

      setForm({ name: '', email: '', phone: '', course: '' });
      setEditingId(null);
      setPage(1);
      await fetchStudents(1, search);
    } catch (err) {
      console.error('Failed to save student', err);
      setFormError('Could not reach the server.');
    }
    setSaving(false);
  };

  // Load a student's details into the form for editing
  const handleEdit = (student) => {
    setEditingId(student.id);
    setForm({
      name: student.name,
      email: student.email,
      phone: student.phone || '',
      course: student.course,
    });
    setFormError('');
  };

  // Cancel an in-progress edit
  const handleCancelEdit = () => {
    setEditingId(null);
    setForm({ name: '', email: '', phone: '', course: '' });
    setFormError('');
  };

  // Delete a student registration
  const handleDelete = async (id) => {
    try {
      await fetch(`${API_URL}/students/${id}`, { method: 'DELETE' });
      await fetchStudents(page, search);
    } catch (err) {
      console.error('Failed to delete student', err);
    }
  };

  // Run a search (resets to page 1)
  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchStudents(1, search);
  };

  // Turn "Jane Doe" into "JD" for the avatar circle
  const getInitials = (name) => {
    const parts = name.trim().split(/\s+/);
    return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join('');
  };

  return (
    <div className={`app ${darkMode ? 'dark' : ''}`}>
      <button className="dark-toggle" onClick={() => setDarkMode(!darkMode)}>
        {darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
      </button>

      <h1>🎓 Student Registration</h1>

      {/* ---------- Registration / Edit form ---------- */}
      <div className="card">
        <h2>{editingId ? 'Edit Student' : 'Register a New Student'}</h2>
        <form onSubmit={handleSubmit} className="reg-form">
          <div className="form-row">
            <input
              type="text"
              name="name"
              placeholder="Full name"
              value={form.name}
              onChange={handleChange}
              maxLength={40}
            />
            <span className="char-counter">{form.name.length}/40</span>
          </div>

          <input
            type="email"
            name="email"
            placeholder="Email address"
            value={form.email}
            onChange={handleChange}
          />

          <input
            type="tel"
            name="phone"
            placeholder="Phone number (optional)"
            value={form.phone}
            onChange={handleChange}
          />

          <input
            type="text"
            name="course"
            placeholder="Course (e.g. B.Sc Computer Science)"
            value={form.course}
            onChange={handleChange}
          />

          {formError && <p className="form-error">{formError}</p>}

          <div className="form-buttons">
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'Saving...' : editingId ? 'Update Student' : 'Register'}
            </button>
            {editingId && (
              <button type="button" onClick={handleCancelEdit} className="btn btn-secondary">
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ---------- Student list ---------- */}
      <div className="card">
        <div className="section-header">
          <h2>📋 Registered Students</h2>
          {lastUpdated && <span className="last-updated">Last updated: {lastUpdated}</span>}
        </div>

        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            placeholder="Search by name or course..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="btn btn-secondary">
            Search
          </button>
        </form>

        {loading ? (
          <p className="loading">Loading students...</p>
        ) : students.length === 0 ? (
          <p className="empty">No students found.</p>
        ) : (
          <ul className="student-list">
            {students.map((student) => (
              <li key={student.id} className="student-row">
                <span className="avatar">{getInitials(student.name)}</span>
                <div className="student-info">
                  <span className="student-name">{student.name}</span>
                  <span className="student-meta">
                    {student.course} · {student.email}
                    {student.phone && ` · ${student.phone}`}
                  </span>
                  <span className="registered-at">
                    Registered: {new Date(student.registered_at).toLocaleString()}
                  </span>
                </div>
                <div className="student-actions">
                  <button className="btn btn-secondary" onClick={() => handleEdit(student)}>
                    Edit
                  </button>
                  <button className="btn btn-danger" onClick={() => handleDelete(student.id)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="pagination">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="btn btn-secondary"
          >
            ◀ Prev
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="btn btn-secondary"
          >
            Next ▶
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
