-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  baseline_emissions REAL DEFAULT 15.0, -- Default daily baseline in kg CO2
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Activity Logs Table
CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  activity_date TEXT NOT NULL, -- Format: YYYY-MM-DD
  category TEXT NOT NULL, -- 'transportation', 'electricity', 'food'
  activity TEXT NOT NULL, -- e.g. 'gasoline_car', 'grid_electricity', 'beef_meal'
  value REAL NOT NULL, -- km, kWh, or meal count
  co2_emissions REAL NOT NULL, -- Calculated CO2 in kg
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for efficient date and user based queries
CREATE INDEX IF NOT EXISTS idx_logs_user_date ON logs(user_id, activity_date);

-- Insert a default user for MVP dashboard testing
INSERT OR IGNORE INTO users (id, name, baseline_emissions) VALUES (1, 'Eco Challenger', 15.0);
