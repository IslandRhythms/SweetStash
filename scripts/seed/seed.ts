import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

import {
  CANDY_LOGS,
  COSTUMES,
  HOUSES,
  HOUSE_VISITS,
  LOCATION_POINTS,
  PROFILES,
  SESSIONS,
} from './seedData.js';

const OUTPUT_DIR = path.join(process.cwd(), 'output');
const DB_PATH = path.join(OUTPUT_DIR, 'sweetstash.db');

function createSchema(db: Database.Database) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      avatar_path TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS costumes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      image_path TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (profile_id) REFERENCES profiles(id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      costume_id INTEGER,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      FOREIGN KEY (profile_id) REFERENCES profiles(id),
      FOREIGN KEY (costume_id) REFERENCES costumes(id)
    );

    CREATE TABLE IF NOT EXISTS location_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE TABLE IF NOT EXISTS houses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      notes TEXT,
      image_path TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (profile_id) REFERENCES profiles(id)
    );

    CREATE TABLE IF NOT EXISTS house_visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      house_id INTEGER NOT NULL,
      visited_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id),
      FOREIGN KEY (house_id) REFERENCES houses(id)
    );

    CREATE TABLE IF NOT EXISTS candy_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      session_id INTEGER,
      candy_name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      image_path TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (profile_id) REFERENCES profiles(id),
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_candy_logs_profile ON candy_logs(profile_id);
    CREATE INDEX IF NOT EXISTS idx_candy_logs_session ON candy_logs(session_id);
    CREATE INDEX IF NOT EXISTS idx_location_points_session ON location_points(session_id);
    CREATE INDEX IF NOT EXISTS idx_house_visits_session ON house_visits(session_id);
  `);
}

function clearData(db: Database.Database) {
  db.exec(`
    DELETE FROM candy_logs;
    DELETE FROM house_visits;
    DELETE FROM location_points;
    DELETE FROM sessions;
    DELETE FROM houses;
    DELETE FROM costumes;
    DELETE FROM profiles;
  `);
}

function toIso(msAgo: number): string {
  return new Date(Date.now() - msAgo).toISOString();
}

function run() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const db = new Database(DB_PATH);
  createSchema(db);
  clearData(db);

  const insertProfile = db.prepare(
    'INSERT INTO profiles (name, avatar_path) VALUES (?, ?)'
  );
  const insertCostume = db.prepare(
    'INSERT INTO costumes (profile_id, name, image_path) VALUES (?, ?, ?)'
  );
  const insertHouse = db.prepare(
    'INSERT INTO houses (profile_id, name, latitude, longitude, notes, image_path) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertSession = db.prepare(
    'INSERT INTO sessions (profile_id, costume_id, started_at, ended_at) VALUES (?, ?, ?, ?)'
  );
  const insertLocationPoint = db.prepare(
    'INSERT INTO location_points (session_id, latitude, longitude, timestamp) VALUES (?, ?, ?, ?)'
  );
  const insertHouseVisit = db.prepare(
    'INSERT INTO house_visits (session_id, house_id, visited_at) VALUES (?, ?, ?)'
  );
  const insertCandyLog = db.prepare(
    'INSERT INTO candy_logs (profile_id, session_id, candy_name, quantity, image_path) VALUES (?, ?, ?, ?, ?)'
  );

  const profileIds: number[] = [];
  for (const p of PROFILES) {
    const r = insertProfile.run(p.name, p.avatar_path);
    profileIds.push(r.lastInsertRowid as number);
  }

  const costumeIds: number[] = [];
  for (const c of COSTUMES) {
    const r = insertCostume.run(profileIds[c.profileIndex], c.name, c.image_path);
    costumeIds.push(r.lastInsertRowid as number);
  }

  const houseIdsByProfile: number[][] = [[], []];
  for (let i = 0; i < HOUSES.length; i++) {
    const h = HOUSES[i];
    const r = insertHouse.run(
      profileIds[h.profileIndex],
      h.name,
      h.latitude,
      h.longitude,
      h.notes,
      h.image_path
    );
    houseIdsByProfile[h.profileIndex].push(r.lastInsertRowid as number);
  }

  const sessionIds: number[] = [];
  const sessionProfileIndices: number[] = [];
  for (const s of SESSIONS) {
    const startedMs = s.startedAtOffsetMinutes * 60 * 1000;
    const endedMs = startedMs - s.durationMinutes * 60 * 1000;
    const costumeId = s.costumeIndex >= 0 ? costumeIds[s.costumeIndex] : null;
    const r = insertSession.run(
      profileIds[s.profileIndex],
      costumeId,
      toIso(startedMs),
      toIso(endedMs)
    );
    sessionIds.push(r.lastInsertRowid as number);
    sessionProfileIndices.push(s.profileIndex);
  }

  for (let i = 0; i < LOCATION_POINTS.length; i++) {
    const lp = LOCATION_POINTS[i];
    const sessionId = sessionIds[lp.sessionIndex];
    const ts = toIso((LOCATION_POINTS.length - i) * 60000);
    insertLocationPoint.run(sessionId, lp.lat, lp.lng, ts);
  }

  for (const hv of HOUSE_VISITS) {
    const sessionId = sessionIds[hv.sessionIndex];
    const profileIdx = sessionProfileIndices[hv.sessionIndex];
    const houseId = houseIdsByProfile[profileIdx][hv.houseIndexInProfile];
    insertHouseVisit.run(sessionId, houseId, toIso(60000));
  }

  for (const c of CANDY_LOGS) {
    const sessionId = c.sessionIndex >= 0 ? sessionIds[c.sessionIndex] : null;
    insertCandyLog.run(
      profileIds[c.profileIndex],
      sessionId,
      c.candyName,
      c.quantity,
      null
    );
  }

  db.close();
  console.log(`Seed complete. Database written to ${DB_PATH}`);
}

run();
