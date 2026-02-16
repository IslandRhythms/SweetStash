import * as SQLite from 'expo-sqlite';
import type {
  Profile,
  Costume,
  Session,
  LocationPoint,
  House,
  HouseVisit,
  CandyLog,
} from '@/types';

const DATABASE_NAME = 'sweetstash.db';
const DATABASE_VERSION = 4;

export async function migrateDb(db: SQLite.SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) return;

  if (currentVersion < 1) {
    await db.execAsync(`
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
    await db.execAsync(`PRAGMA user_version = 1`);
  }

  if (currentVersion < 2) {
    await db.execAsync(`
      INSERT INTO profiles (name)
      SELECT 'Trick-or-Treater'
      WHERE NOT EXISTS (SELECT 1 FROM profiles);
    `);
    await db.execAsync(`PRAGMA user_version = 2`);
  }

  if (currentVersion < 3) {
    const cols = await db.getAllAsync<{ name: string }>(
      'PRAGMA table_info(candy_logs)'
    );
    if (!cols.some((c) => c.name === 'is_favorite')) {
      await db.execAsync(`
        ALTER TABLE candy_logs ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0;
      `);
    }
    await db.execAsync(`PRAGMA user_version = 3`);
  }

  if (currentVersion < 4) {
    const cols = await db.getAllAsync<{ name: string }>(
      'PRAGMA table_info(houses)'
    );
    if (!cols.some((c) => c.name === 'is_favorite')) {
      await db.execAsync(`
        ALTER TABLE houses ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0;
      `);
    }
    await db.execAsync(`PRAGMA user_version = 4`);
  }
}

// Profile CRUD
export async function getProfiles(db: SQLite.SQLiteDatabase): Promise<Profile[]> {
  return db.getAllAsync<Profile>('SELECT * FROM profiles ORDER BY created_at DESC');
}

export async function createProfile(
  db: SQLite.SQLiteDatabase,
  name: string,
  avatar_path?: string | null
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO profiles (name, avatar_path) VALUES (?, ?)',
    name,
    avatar_path ?? null
  );
  return result.lastInsertRowId;
}

export async function updateProfile(
  db: SQLite.SQLiteDatabase,
  id: number,
  name: string,
  avatar_path?: string | null
): Promise<void> {
  await db.runAsync(
    'UPDATE profiles SET name = ?, avatar_path = ? WHERE id = ?',
    name,
    avatar_path ?? null,
    id
  );
}

export async function getProfile(
  db: SQLite.SQLiteDatabase,
  id: number
): Promise<Profile | null> {
  return db.getFirstAsync<Profile>('SELECT * FROM profiles WHERE id = ?', id);
}

export async function getFirstProfile(
  db: SQLite.SQLiteDatabase
): Promise<Profile | null> {
  return db.getFirstAsync<Profile>(
    'SELECT * FROM profiles ORDER BY id ASC LIMIT 1'
  );
}

// Costume CRUD
export async function getCostumes(
  db: SQLite.SQLiteDatabase,
  profileId: number
): Promise<Costume[]> {
  return db.getAllAsync<Costume>(
    'SELECT * FROM costumes WHERE profile_id = ? ORDER BY created_at DESC',
    profileId
  );
}

export async function createCostume(
  db: SQLite.SQLiteDatabase,
  profileId: number,
  name: string,
  image_path?: string | null
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO costumes (profile_id, name, image_path) VALUES (?, ?, ?)',
    profileId,
    name,
    image_path ?? null
  );
  return result.lastInsertRowId;
}

export async function getCostume(
  db: SQLite.SQLiteDatabase,
  id: number
): Promise<Costume | null> {
  return db.getFirstAsync<Costume>('SELECT * FROM costumes WHERE id = ?', id);
}

// Session CRUD
export async function createSession(
  db: SQLite.SQLiteDatabase,
  profileId: number,
  costumeId?: number | null
): Promise<number> {
  const startedAt = new Date().toISOString();
  const result = await db.runAsync(
    'INSERT INTO sessions (profile_id, costume_id, started_at) VALUES (?, ?, ?)',
    profileId,
    costumeId ?? null,
    startedAt
  );
  return result.lastInsertRowId;
}

export async function endSession(
  db: SQLite.SQLiteDatabase,
  sessionId: number
): Promise<void> {
  const endedAt = new Date().toISOString();
  await db.runAsync('UPDATE sessions SET ended_at = ? WHERE id = ?', endedAt, sessionId);
}

export async function getActiveSession(
  db: SQLite.SQLiteDatabase,
  profileId: number
): Promise<Session | null> {
  return db.getFirstAsync<Session>(
    'SELECT * FROM sessions WHERE profile_id = ? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1',
    profileId
  );
}

export async function getSession(
  db: SQLite.SQLiteDatabase,
  id: number
): Promise<Session | null> {
  return db.getFirstAsync<Session>('SELECT * FROM sessions WHERE id = ?', id);
}

export async function getSessions(
  db: SQLite.SQLiteDatabase,
  profileId: number
): Promise<Session[]> {
  return db.getAllAsync<Session>(
    'SELECT * FROM sessions WHERE profile_id = ? AND ended_at IS NOT NULL ORDER BY started_at DESC',
    profileId
  );
}

// Location points
export async function addLocationPoint(
  db: SQLite.SQLiteDatabase,
  sessionId: number,
  latitude: number,
  longitude: number
): Promise<void> {
  const timestamp = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO location_points (session_id, latitude, longitude, timestamp) VALUES (?, ?, ?, ?)',
    sessionId,
    latitude,
    longitude,
    timestamp
  );
}

export async function getLocationPoints(
  db: SQLite.SQLiteDatabase,
  sessionId: number
): Promise<LocationPoint[]> {
  return db.getAllAsync<LocationPoint>(
    'SELECT * FROM location_points WHERE session_id = ? ORDER BY timestamp ASC',
    sessionId
  );
}

// House CRUD
export async function getHouses(
  db: SQLite.SQLiteDatabase,
  profileId: number
): Promise<House[]> {
  return db.getAllAsync<House>(
    'SELECT * FROM houses WHERE profile_id = ? ORDER BY is_favorite DESC, created_at DESC',
    profileId
  );
}

export async function createHouse(
  db: SQLite.SQLiteDatabase,
  profileId: number,
  name: string,
  opts?: {
    latitude?: number | null;
    longitude?: number | null;
    notes?: string | null;
    image_path?: string | null;
  }
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO houses (profile_id, name, latitude, longitude, notes, image_path) VALUES (?, ?, ?, ?, ?, ?)',
    profileId,
    name,
    opts?.latitude ?? null,
    opts?.longitude ?? null,
    opts?.notes ?? null,
    opts?.image_path ?? null
  );
  return result.lastInsertRowId;
}

export async function updateHouse(
  db: SQLite.SQLiteDatabase,
  id: number,
  data: Partial<Pick<House, 'name' | 'latitude' | 'longitude' | 'notes' | 'image_path' | 'is_favorite'>>
): Promise<void> {
  const updates: string[] = [];
  const values: (string | number | null)[] = [];
  if (data.name !== undefined) {
    updates.push('name = ?');
    values.push(data.name);
  }
  if (data.latitude !== undefined) {
    updates.push('latitude = ?');
    values.push(data.latitude);
  }
  if (data.longitude !== undefined) {
    updates.push('longitude = ?');
    values.push(data.longitude);
  }
  if (data.notes !== undefined) {
    updates.push('notes = ?');
    values.push(data.notes);
  }
  if (data.image_path !== undefined) {
    updates.push('image_path = ?');
    values.push(data.image_path);
  }
  if (data.is_favorite !== undefined) {
    updates.push('is_favorite = ?');
    values.push(data.is_favorite);
  }
  if (updates.length > 0) {
    values.push(id);
    await db.runAsync(
      `UPDATE houses SET ${updates.join(', ')} WHERE id = ?`,
      ...values
    );
  }
}

export async function setHouseFavorite(
  db: SQLite.SQLiteDatabase,
  id: number,
  isFavorite: boolean
): Promise<void> {
  await db.runAsync(
    'UPDATE houses SET is_favorite = ? WHERE id = ?',
    isFavorite ? 1 : 0,
    id
  );
}

export async function getHouse(
  db: SQLite.SQLiteDatabase,
  id: number
): Promise<House | null> {
  return db.getFirstAsync<House>('SELECT * FROM houses WHERE id = ?', id);
}

// House visits
export async function addHouseVisit(
  db: SQLite.SQLiteDatabase,
  sessionId: number,
  houseId: number
): Promise<number> {
  const visitedAt = new Date().toISOString();
  const result = await db.runAsync(
    'INSERT INTO house_visits (session_id, house_id, visited_at) VALUES (?, ?, ?)',
    sessionId,
    houseId,
    visitedAt
  );
  return result.lastInsertRowId;
}

export async function getHouseVisits(
  db: SQLite.SQLiteDatabase,
  sessionId: number
): Promise<(HouseVisit & { house?: House })[]> {
  const visits = await db.getAllAsync<HouseVisit>(
    'SELECT * FROM house_visits WHERE session_id = ? ORDER BY visited_at ASC',
    sessionId
  );
  for (const v of visits) {
    const house = await getHouse(db, v.house_id);
    (v as HouseVisit & { house?: House }).house = house ?? undefined;
  }
  return visits as (HouseVisit & { house?: House })[];
}

// Candy logs
export async function getCandyLogs(
  db: SQLite.SQLiteDatabase,
  profileId: number,
  sessionId?: number | null
): Promise<CandyLog[]> {
  if (sessionId != null) {
    return db.getAllAsync<CandyLog>(
      'SELECT * FROM candy_logs WHERE profile_id = ? AND session_id = ? ORDER BY created_at DESC',
      profileId,
      sessionId
    );
  }
  return db.getAllAsync<CandyLog>(
    'SELECT * FROM candy_logs WHERE profile_id = ? ORDER BY is_favorite DESC, created_at DESC',
    profileId
  );
}

export async function createCandyLog(
  db: SQLite.SQLiteDatabase,
  profileId: number,
  candyName: string,
  quantity: number,
  opts?: { sessionId?: number | null; image_path?: string | null }
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO candy_logs (profile_id, session_id, candy_name, quantity, image_path) VALUES (?, ?, ?, ?, ?)',
    profileId,
    opts?.sessionId ?? null,
    candyName,
    quantity,
    opts?.image_path ?? null
  );
  return result.lastInsertRowId;
}

export async function updateCandyLog(
  db: SQLite.SQLiteDatabase,
  id: number,
  data: Partial<Pick<CandyLog, 'candy_name' | 'quantity' | 'image_path' | 'is_favorite'>>
): Promise<void> {
  if (data.candy_name !== undefined)
    await db.runAsync('UPDATE candy_logs SET candy_name = ? WHERE id = ?', data.candy_name, id);
  if (data.quantity !== undefined)
    await db.runAsync('UPDATE candy_logs SET quantity = ? WHERE id = ?', data.quantity, id);
  if (data.image_path !== undefined)
    await db.runAsync('UPDATE candy_logs SET image_path = ? WHERE id = ?', data.image_path, id);
  if (data.is_favorite !== undefined)
    await db.runAsync('UPDATE candy_logs SET is_favorite = ? WHERE id = ?', data.is_favorite, id);
}

export async function setCandyFavorite(
  db: SQLite.SQLiteDatabase,
  id: number,
  isFavorite: boolean
): Promise<void> {
  await db.runAsync(
    'UPDATE candy_logs SET is_favorite = ? WHERE id = ?',
    isFavorite ? 1 : 0,
    id
  );
}

export async function getCandyLog(
  db: SQLite.SQLiteDatabase,
  id: number
): Promise<CandyLog | null> {
  return db.getFirstAsync<CandyLog>('SELECT * FROM candy_logs WHERE id = ?', id);
}

// Stats helpers
export async function getSessionStats(
  db: SQLite.SQLiteDatabase,
  sessionId: number
): Promise<{ candyCount: number; houseCount: number }> {
  const candyRow = await db.getFirstAsync<{ count: number }>(
    'SELECT COALESCE(SUM(quantity), 0) as count FROM candy_logs WHERE session_id = ?',
    sessionId
  );
  const houseRow = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM house_visits WHERE session_id = ?',
    sessionId
  );
  return {
    candyCount: candyRow?.count ?? 0,
    houseCount: houseRow?.count ?? 0,
  };
}
