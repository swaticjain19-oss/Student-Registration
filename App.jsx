// frontend/src/App.jsx
import { useState, useEffect } from 'react';
import './App.css';

const API_URL = 'http://localhost:5000';

export default function App() {
  const [habits, setHabits] = useState([]);
  const [checkinsByHabit, setCheckinsByHabit] = useState({});
  const [loading, setLoading] = useState(true);
  const [newHabitName, setNewHabitName] = useState('');

  const refreshAll = async () => {
    try {
      const res = await fetch(`${API_URL}/habits`);
      const habitsData = await res.json();
      setHabits(habitsData);

      const checkinsMapping = {};
      await Promise.all(
        habitsData.map(async (habit) => {
          const checkinRes = await fetch(`${API_URL}/habits/${habit.id}/checkins`);
          const checkinDates = await checkinRes.json();
          checkinsMapping[habit.id] = checkinDates;
        })
      );
      setCheckinsByHabit(checkinsMapping);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, []);

  const handleAddHabit = async (e) => {
    e.preventDefault();
    if (!newHabitName.trim()) return;

    try {
      const res = await fetch(`${API_URL}/habits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newHabitName.trim() }),
      });
      if (res.ok) {
        setNewHabitName('');
        await refreshAll();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleCheckIn = async (habitId) => {
    try {
      const res = await fetch(`${API_URL}/habits/${habitId}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        await refreshAll();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteHabit = async (habitId) => {
    try {
      const res = await fetch(`${API_URL}/habits/${habitId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await refreshAll();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const getLast7Days = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateString = d.toISOString().split('T')[0];
      const dayNum = d.getDate();
      days.push({ dateString, dayNum });
    }
    return days;
  };

  const last7Days = getLast7Days();
  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="app-container">
      <h1>🔥 Habit Tracker</h1>

      <div className="new-habit-card">
        <form onSubmit={handleAddHabit} className="new-habit-form">
          <input
            type="text"
            placeholder="e.g. Drink 2L water"
            value={newHabitName}
            onChange={(e) => setNewHabitName(e.target.value)}
          />
          <button type="submit">Add Habit</button>
        </form>
      </div>

      <div className="habits-section">
        {loading ? (
          <p>Loading your habits...</p>
        ) : habits.length === 0 ? (
          <p>No habits yet. Add one above to get started!</p>
        ) : (
          habits.map((habit) => {
            const habitCheckins = checkinsByHabit[habit.id] || [];
            const isCheckedInToday = habitCheckins.includes(todayStr);

            return (
              <div key={habit.id} className="habit-card">
                <h3>{habit.name}</h3>
                
                <p className={`streak-text ${habit.streak > 0 ? 'active-streak' : ''}`}>
                  {habit.streak > 0 ? `🔥 ${habit.streak} day streak` : 'No streak yet — check in today!'}
                </p>

                {isCheckedInToday ? (
                  <button className="checkin-btn checked" disabled>
                    ✅ Checked in today
                  </button>
                ) : (
                  <button className="checkin-btn" onClick={() => handleCheckIn(habit.id)}>
                    Check In
                  </button>
                )}

                <div className="history-row">
                  {last7Days.map((day) => {
                    const isDone = habitCheckins.includes(day.dateString);
                    return (
                      <div
                        key={day.dateString}
                        className={`history-box ${isDone ? 'done' : 'not-done'}`}
                        title={day.dateString}
                      >
                        {day.dayNum}
                      </div>
                    );
                  })}
                </div>

                <button className="delete-btn" onClick={() => handleDeleteHabit(habit.id)}>
                  Delete Habit
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}