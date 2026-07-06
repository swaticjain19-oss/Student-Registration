// backend/index.js
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');

const app = express();
app.use(cors());
app.use(express.json());

const db = new Database('data.db');

// Create the habits table to store user habits
db.prepare(`
  CREATE TABLE IF NOT EXISTS habits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`).run();

// Create the checkins table to track completed habit dates
db.prepare(`
  CREATE TABLE IF NOT EXISTS checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    habit_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    checked_at TEXT NOT NULL,
    UNIQUE(habit_id, date)
  )
`).run();

/**
 * Calculates the current consecutive daily streak for a specific habit.
 * It fetches all check-ins for the habit ordered by date descending, then checks
 * sequentially backwards from today's date to see if a check-in exists for each day.
 * If neither today nor yesterday has a check-in, the streak resets to 0. If yesterday
 * has a check-in but today doesn't yet, the streak is preserved.
 */
function calculateStreak(habitId) {
  const checkins = db.prepare('SELECT date FROM checkins WHERE habit_id = ? ORDER BY date DESC').all(habitId);
  const checkedDates = new Set(checkins.map(c => c.date));

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  if (!checkedDates.has(todayStr) && !checkedDates.has(yesterdayStr)) {
    return 0;
  }

  let streak = 0;
  let currentCheckDate = checkedDates.has(todayStr) ? now : yesterday;

  while (true) {
    const checkStr = currentCheckDate.toISOString().split('T')[0];
    if (checkedDates.has(checkStr)) {
      streak++;
      currentCheckDate.setDate(currentCheckDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

// Route A: Create a new habit
app.post('/habits', (req, res) => {
  const { name } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'name is required' });
  }

  const createdAt = new Date().toISOString();
  const info = db.prepare('INSERT INTO habits (name, created_at) VALUES (?, ?)').run(name.trim(), createdAt);
  
  res.status(201).json({
    id: info.lastInsertRowid,
    name: name.trim(),
    created_at: createdAt,
    streak: 0
  });
});

// Route B: List all habits along with each one's current streak
app.get('/habits', (req, res) => {
  const habits = db.prepare('SELECT * FROM habits ORDER BY created_at ASC').all();
  const habitsWithStreak = habits.map(habit => {
    habit.streak = calculateStreak(habit.id);
    return habit;
  });
  res.status(200).json(habitsWithStreak);
});

// Route C: Mark a habit as done for a specific date (defaults to today)
app.post('/habits/:id/checkin', (req, res) => {
  const habitId = parseInt(req.params.id, 10);
  let { date } = req.body;

  if (!date) {
    date = new Date().toISOString().split('T')[0];
  }

  const habit = db.prepare('SELECT id FROM habits WHERE id = ?').get(habitId);
  if (!habit) {
    return res.status(404).json({ error: 'Habit not found' });
  }

  try {
    const checkedAt = new Date().toISOString();
    const info = db.prepare('INSERT INTO checkins (habit_id, date, checked_at) VALUES (?, ?, ?)').run(habitId, date, checkedAt);
    const updatedStreak = calculateStreak(habitId);

    res.status(201).json({
      id: info.lastInsertRowid,
      habit_id: habitId,
      date: date,
      checked_at: checkedAt,
      streak: updatedStreak
    });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Already checked in for this date' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route D: Return all check-in dates for one habit, for rendering a calendar/history view
app.get('/habits/:id/checkins', (req, res) => {
  const habitId = parseInt(req.params.id, 10);
  const habit = db.prepare('SELECT id FROM habits WHERE id = ?').get(habitId);
  if (!habit) {
    return res.status(404).json({ error: 'Habit not found' });
  }

  const checkins = db.prepare('SELECT date FROM checkins WHERE habit_id = ? ORDER BY date DESC').all(habitId);
  const dateStrings = checkins.map(c => c.date);
  res.status(200).json(dateStrings);
});

// Route E: Undo a check-in for a specific date (in case the user misclicked)
app.delete('/habits/:id/checkin/:date', (req, res) => {
  const habitId = parseInt(req.params.id, 10);
  const { date } = req.params;

  db.prepare('DELETE FROM checkins WHERE habit_id = ? AND date = ?').run(habitId, date);
  res.status(200).json({ message: 'Checkin removed' });
});

// Route F: Delete a habit entirely, along with all of its check-in history
app.delete('/habits/:id', (req, res) => {
  const habitId = parseInt(req.params.id, 10);

  db.prepare('DELETE FROM checkins WHERE habit_id = ?').run(habitId);
  db.prepare('DELETE FROM habits WHERE id = ?').run(habitId);

  res.status(200).json({ message: `Habit ${habitId} and its checkins deleted` });
});

app.listen(5000, () => {
  console.log('Server running on http://localhost:5000');
});