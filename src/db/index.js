const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const fs = require('fs');
const path = require('path');

let dbInstance = null;

/**
 * Retrieves the database connection instance.
 * @param {string|null} dbPath Optional database path override (e.g. ':memory:' for tests)
 */
async function getDb(dbPath = null) {
  if (dbInstance) return dbInstance;

  const targetPath = dbPath || process.env.DB_FILE || path.join(__dirname, 'verda.db');

  // Ensure directory exists for file-based DBs
  if (targetPath !== ':memory:') {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  dbInstance = await open({
    filename: targetPath,
    driver: sqlite3.Database
  });

  // Enable foreign key support in SQLite
  await dbInstance.run('PRAGMA foreign_keys = ON');

  return dbInstance;
}

/**
 * Initializes the database schema from schema.sql.
 * @param {string|null} dbPath Optional database path override
 */
async function initDb(dbPath = null) {
  const db = await getDb(dbPath);
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  // exec allows running multiple SQL queries separated by semicolons
  await db.exec(schema);
  return db;
}

/**
 * Closes the database connection.
 */
async function closeDb() {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}

module.exports = {
  getDb,
  initDb,
  closeDb
};
