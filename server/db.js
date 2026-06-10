import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATABASE_PATH || join(__dirname, "data", "dex-keeper.db");

mkdirSync(dirname(dbPath), { recursive: true });

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_lists (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    lists_json TEXT NOT NULL DEFAULT '[]'
  );
`);

export function findUserByUsername(username) {
  return db.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE").get(username);
}

export function createUser(username, passwordHash) {
  const createdAt = Date.now();
  const info = db
    .prepare("INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)")
    .run(username, passwordHash, createdAt);
  db.prepare("INSERT INTO user_lists (user_id, lists_json) VALUES (?, '[]')").run(info.lastInsertRowid);
  return { id: info.lastInsertRowid, username, created_at: createdAt };
}

export function getLists(userId) {
  const row = db.prepare("SELECT lists_json FROM user_lists WHERE user_id = ?").get(userId);
  return row ? JSON.parse(row.lists_json) : [];
}

export function saveLists(userId, lists) {
  const info = db.prepare("UPDATE user_lists SET lists_json = ? WHERE user_id = ?").run(JSON.stringify(lists), userId);
  return info.changes > 0;
}

export default db;
