import type {
  Candy,
  CandyLog,
  Costume,
  CostumePhoto,
  CostumePhotoWithSession,
  CostumeWithPhotoCount,
  House,
  HouseVisit,
  LocationPoint,
  Profile,
  Session,
  StashRound,
} from '@/types';
import * as SQLite from 'expo-sqlite';

import { normalizeStoredImagePath } from '@/lib/images';

const DATABASE_NAME = 'sweetstash.db';
const DATABASE_VERSION = 12;

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

  if (currentVersion < 5) {
    const cols = await db.getAllAsync<{ name: string }>(
      'PRAGMA table_info(candy_logs)'
    );
    if (!cols.some((c) => c.name === 'house_id')) {
      await db.execAsync(`
        ALTER TABLE candy_logs ADD COLUMN house_id INTEGER REFERENCES houses(id);
      `);
    }
    await db.execAsync(`PRAGMA user_version = 5`);
  }

  if (currentVersion < 6) {
    // Create candies reference table (sort_order, emoji, is_common for UI and quick-add)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS candies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 999,
        emoji TEXT,
        is_common INTEGER NOT NULL DEFAULT 0,
        image_path TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_candies_name ON candies(name);
      CREATE INDEX IF NOT EXISTS idx_candies_sort ON candies(sort_order);
    `);

    // Seed candies: name, category, sort_order (1=Chocolate,2=Fruity,3=Hard,4=Chewy,5=Sour,6=Seasonal,7=Snack,8=Healthy), emoji, is_common
    await db.execAsync(`
      INSERT OR IGNORE INTO candies (name, category, sort_order, emoji, is_common) VALUES
      ('Snickers','Chocolate',1,'🍫',1),
      ('Milky Way','Chocolate',1,'🍫',0),
      ('3 Musketeers','Chocolate',1,'🍫',0),
      ('Twix','Chocolate',1,'🍫',1),
      ('Kit Kat','Chocolate',1,'🍫',1),
      ('Butterfinger','Chocolate',1,'🍫',0),
      ('Crunch','Chocolate',1,'🍫',0),
      ('Hershey''s Milk Chocolate','Chocolate',1,'🍫',0),
      ('Hershey''s Cookies ''n'' Creme','Chocolate',1,'🍫',0),
      ('Mr. Goodbar','Chocolate',1,'🍫',0),
      ('Reese''s Peanut Butter Cups','Chocolate',1,'🍫',1),
      ('Reese''s Pieces','Chocolate',1,'🍫',0),
      ('Almond Joy','Chocolate',1,'🍫',0),
      ('Mounds','Chocolate',1,'🍫',0),
      ('Baby Ruth','Chocolate',1,'🍫',0),
      ('100 Grand','Chocolate',1,'🍫',0),
      ('York Peppermint Pattie','Chocolate',1,'🍫',0),
      ('Dove Chocolate','Chocolate',1,'🍫',0),
      ('Ghirardelli Squares','Chocolate',1,'🍫',0),
      ('Lindt Truffles','Chocolate',1,'🍫',0),
      ('M&M''s','Chocolate',1,'🍫',1),
      ('Hershey''s Kisses','Chocolate',1,'🍫',1),
      ('Whoppers','Chocolate',1,'🍫',0),
      ('Take 5','Chocolate',1,'🍫',0),
      ('Whatchamacallit','Chocolate',1,'🍫',0),
      ('5th Avenue','Chocolate',1,'🍫',0),
      ('Zero Bar','Chocolate',1,'🍫',0),
      ('Symphony Bar','Chocolate',1,'🍫',0),
      ('Reese''s Mini','Chocolate',1,'🍫',0),
      ('Cadbury Dairy Milk','Chocolate',1,'🍫',0),
      ('Ferrero Rocher','Chocolate',1,'🍫',0),
      ('Godiva','Chocolate',1,'🍫',0),
      ('Toblerone','Chocolate',1,'🍫',0),
      ('Mars Bar','Chocolate',1,'🍫',0),
      ('Payday','Chocolate',1,'🍫',0),
      ('Reese''s Fast Break','Chocolate',1,'🍫',0),
      ('Reese''s Sticks','Chocolate',1,'🍫',0),
      ('Peanut M&M''s','Chocolate',1,'🍫',0),
      ('Peanut Butter M&M''s','Chocolate',1,'🍫',0),
      ('Skittles','Fruity',2,'🍬',1),
      ('Starburst','Fruity',2,'🍬',1),
      ('Sour Patch Kids','Fruity',2,'🍬',0),
      ('Swedish Fish','Fruity',2,'🍬',0),
      ('Haribo Goldbears','Fruity',2,'🍬',0),
      ('Lifesavers Gummies','Fruity',2,'🍬',0),
      ('Trolli Sour Brite Crawlers','Fruity',2,'🍬',0),
      ('Nerds','Fruity',2,'🍬',0),
      ('Nerds Gummy Clusters','Fruity',2,'🍬',0),
      ('Mike and Ike','Fruity',2,'🍬',0),
      ('Jelly Belly','Fruity',2,'🍬',0),
      ('Dots','Fruity',2,'🍬',0),
      ('Runts','Fruity',2,'🍬',0),
      ('Hi-Chew','Fruity',2,'🍬',0),
      ('Airheads','Fruity',2,'🍬',0),
      ('Airheads Xtremes','Fruity',2,'🍬',0),
      ('Fruit by the Foot','Fruity',2,'🍬',0),
      ('Gushers','Fruity',2,'🍬',0),
      ('Welch''s Fruit Snacks','Fruity',2,'🍬',0),
      ('Black Forest Gummies','Fruity',2,'🍬',0),
      ('Starburst Minis','Fruity',2,'🍬',0),
      ('Skittles Sour','Fruity',2,'🍬',0),
      ('Jolly Rancher Gummies','Fruity',2,'🍬',0),
      ('Pixy Stix','Fruity',2,'🍬',0),
      ('Fun Dip','Fruity',2,'🍬',0),
      ('Bottle Caps','Fruity',2,'🍬',0),
      ('Smarties (US)','Fruity',2,'🍬',0),
      ('Jolly Ranchers','Hard Candy',3,'🍭',0),
      ('Dum Dums','Hard Candy',3,'🍭',0),
      ('Tootsie Pops','Hard Candy',3,'🍭',0),
      ('Blow Pops','Hard Candy',3,'🍭',0),
      ('Ring Pop','Hard Candy',3,'🍭',0),
      ('Push Pop','Hard Candy',3,'🍭',0),
      ('Smarties','Hard Candy',3,'🍭',0),
      ('Lifesavers','Hard Candy',3,'🍭',0),
      ('Werther''s Original','Hard Candy',3,'🍭',0),
      ('Lemonheads','Hard Candy',3,'🍭',0),
      ('Atomic Fireballs','Hard Candy',3,'🍭',0),
      ('Butterscotch Discs','Hard Candy',3,'🍭',0),
      ('Lollipop','Hard Candy',3,'🍭',1),
      ('Chupa Chups','Hard Candy',3,'🍭',0),
      ('Jawbreakers','Hard Candy',3,'🍭',0),
      ('Candy Buttons','Hard Candy',3,'🍭',0),
      ('Rock Candy','Hard Candy',3,'🍭',0),
      ('Cotton Candy','Hard Candy',3,'🍭',0),
      ('Tootsie Rolls','Chewy',4,'🍬',0),
      ('Milk Duds','Chewy',4,'🍬',0),
      ('Rolo','Chewy',4,'🍬',0),
      ('Caramel Apple Pops','Chewy',4,'🍬',0),
      ('Laffy Taffy','Chewy',4,'🍬',0),
      ('Now and Later','Chewy',4,'🍬',0),
      ('Bit-O-Honey','Chewy',4,'🍬',0),
      ('Charleston Chew','Chewy',4,'🍬',0),
      ('Marshmallow','Chewy',4,'🍬',0),
      ('Warheads','Sour',5,'🍬',0),
      ('Toxic Waste','Sour',5,'🍬',0),
      ('Sour Skittles','Sour',5,'🍬',0),
      ('Sour Punch Straws','Sour',5,'🍬',0),
      ('Cry Baby Tears','Sour',5,'🍬',0),
      ('Candy Corn','Seasonal',6,'🎃',0),
      ('Pumpkin Shaped Reese''s','Seasonal',6,'🎃',0),
      ('Halloween Gummies','Seasonal',6,'🍬',0),
      ('Mini Chocolate Coins','Seasonal',6,'🪙',0),
      ('Halloween Marshmallow Treats','Seasonal',6,'🍬',0),
      ('Pez','Seasonal',6,'🍬',0),
      ('Marshmallow Peeps','Seasonal',6,'🐣',0),
      ('Candy Pumpkins','Seasonal',6,'🎃',0),
      ('Caramel Corn','Seasonal',6,'🍿',0),
      ('Caramel Apples','Seasonal',6,'🍎',0),
      ('Oreo Mini Packs','Snack',7,'🍪',0),
      ('Chips Ahoy Mini Packs','Snack',7,'🍪',0),
      ('Nutter Butter','Snack',7,'🥜',0),
      ('Rice Krispies Treats','Snack',7,'🍘',0),
      ('Little Debbie Snacks','Snack',7,'🍰',0),
      ('Granola Bars','Snack',7,'🌾',0),
      ('Pretzel Packs','Snack',7,'🥨',0),
      ('Popcorn Balls','Snack',7,'🍿',0),
      ('Goldfish Crackers','Snack',7,'🐟',0),
      ('Cheez-It','Snack',7,'🧀',0),
      ('Pirate''s Booty','Snack',7,'🍿',0),
      ('Annie''s Cheddar Bunnies','Snack',7,'🐰',0),
      ('Chex Mix','Snack',7,'🥨',0),
      ('Bugles','Snack',7,'📯',0),
      ('Cracker Jack','Snack',7,'⚾',0),
      ('Apples','Healthy',8,'🍎',0),
      ('Clementines','Healthy',8,'🍊',0),
      ('Raisin Boxes','Healthy',8,'🍇',0),
      ('Trail Mix','Healthy',8,'🥜',0),
      ('Juice Boxes','Healthy',8,'🧃',0),
      ('Pumpkin Seeds','Healthy',8,'🌰',0),
      ('Banana','Healthy',8,'🍌',0),
      ('Grapes','Healthy',8,'🍇',0),
      ('Fruit Cups','Healthy',8,'🍓',0);
    `);

    await db.execAsync(`PRAGMA user_version = 6`);
  }

  if (currentVersion < 7) {
    const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(sessions)');
    if (!cols.some((c) => c.name === 'name')) {
      await db.execAsync(`ALTER TABLE sessions ADD COLUMN name TEXT`);
    }
    if (!cols.some((c) => c.name === 'linked_session_id')) {
      await db.execAsync(`ALTER TABLE sessions ADD COLUMN linked_session_id INTEGER REFERENCES sessions(id)`);
    }
    await db.execAsync(`PRAGMA user_version = 7`);
  }

  if (currentVersion < 8) {
    const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(sessions)');
    if (!cols.some((c) => c.name === 'session_type')) {
      await db.execAsync(`ALTER TABLE sessions ADD COLUMN session_type TEXT`);
    }
    await db.execAsync(`PRAGMA user_version = 8`);
  }

  if (currentVersion < 9) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS stash_rounds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id INTEGER NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('in_progress', 'done')),
        name TEXT,
        linked_session_id INTEGER REFERENCES sessions(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        ended_at TEXT,
        FOREIGN KEY (profile_id) REFERENCES profiles(id)
      );
      CREATE INDEX IF NOT EXISTS idx_stash_rounds_profile_status ON stash_rounds(profile_id, status);
    `);
    const candyCols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(candy_logs)');
    if (!candyCols.some((c) => c.name === 'stash_round_id')) {
      await db.execAsync(`ALTER TABLE candy_logs ADD COLUMN stash_round_id INTEGER REFERENCES stash_rounds(id)`);
    }
    await db.execAsync(
      'CREATE INDEX IF NOT EXISTS idx_candy_logs_stash_round ON candy_logs(stash_round_id)'
    );
    await db.execAsync(`PRAGMA user_version = 9`);
  }

  if (currentVersion < 10) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS session_shares (
        session_id INTEGER NOT NULL,
        profile_id INTEGER NOT NULL,
        PRIMARY KEY (session_id, profile_id),
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (profile_id) REFERENCES profiles(id)
      );
      CREATE INDEX IF NOT EXISTS idx_session_shares_profile ON session_shares(profile_id);
    `);
    await db.execAsync(`PRAGMA user_version = 10`);
  }

  if (currentVersion < 11) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS costume_photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        costume_id INTEGER NOT NULL,
        session_id INTEGER,
        image_path TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (costume_id) REFERENCES costumes(id) ON DELETE CASCADE,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );
      CREATE INDEX IF NOT EXISTS idx_costume_photos_costume ON costume_photos(costume_id);
    `);
    await db.runAsync(`
      INSERT INTO costume_photos (costume_id, session_id, image_path)
      SELECT id, NULL, image_path FROM costumes
      WHERE image_path IS NOT NULL AND TRIM(image_path) != ''
    `);
    await db.execAsync(`PRAGMA user_version = 11`);
  }

  if (currentVersion < 12) {
    await migrateStoredImagePaths(db);
    await db.execAsync(`PRAGMA user_version = 12`);
  }
}

async function migrateStoredImagePaths(db: SQLite.SQLiteDatabase): Promise<void> {
  const tables: { table: string; column: string }[] = [
    { table: 'profiles', column: 'avatar_path' },
    { table: 'costumes', column: 'image_path' },
    { table: 'houses', column: 'image_path' },
    { table: 'candy_logs', column: 'image_path' },
    { table: 'candies', column: 'image_path' },
    { table: 'costume_photos', column: 'image_path' },
  ];

  for (const { table, column } of tables) {
    const rows = await db.getAllAsync<{ id: number; val: string }>(
      `SELECT id, ${column} AS val FROM ${table} WHERE ${column} IS NOT NULL AND TRIM(${column}) != ''`
    );
    for (const row of rows) {
      const normalized = normalizeStoredImagePath(row.val);
      if (normalized !== row.val) {
        await db.runAsync(`UPDATE ${table} SET ${column} = ? WHERE id = ?`, normalized, row.id);
      }
    }
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

export async function updateCostume(
  db: SQLite.SQLiteDatabase,
  id: number,
  data: Partial<Pick<Costume, 'name' | 'image_path'>>
): Promise<void> {
  const updates: string[] = [];
  const values: (string | number | null)[] = [];
  if (data.name !== undefined) {
    updates.push('name = ?');
    values.push(data.name);
  }
  if (data.image_path !== undefined) {
    updates.push('image_path = ?');
    values.push(data.image_path);
  }
  if (updates.length === 0) return;
  values.push(id);
  await db.runAsync(
    `UPDATE costumes SET ${updates.join(', ')} WHERE id = ?`,
    ...values
  );
}

/** Append a photo for a costume (e.g. same costume different years). Updates costume cover image. */
export async function addCostumePhoto(
  db: SQLite.SQLiteDatabase,
  costumeId: number,
  imagePath: string,
  sessionId?: number | null
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO costume_photos (costume_id, session_id, image_path) VALUES (?, ?, ?)',
    costumeId,
    sessionId ?? null,
    imagePath
  );
  await db.runAsync('UPDATE costumes SET image_path = ? WHERE id = ?', imagePath, costumeId);
  return result.lastInsertRowId;
}

/** Full photo pool for a costume / character across all years (Costumes tab). */
export async function getCostumePhotos(
  db: SQLite.SQLiteDatabase,
  costumeId: number
): Promise<CostumePhoto[]> {
  return db.getAllAsync<CostumePhoto>(
    'SELECT * FROM costume_photos WHERE costume_id = ? ORDER BY created_at ASC, id ASC',
    costumeId
  );
}

/** Photos recorded for this costume during one trick-or-treat session only. */
export async function getCostumePhotosForSession(
  db: SQLite.SQLiteDatabase,
  costumeId: number,
  sessionId: number
): Promise<CostumePhoto[]> {
  return db.getAllAsync<CostumePhoto>(
    `SELECT * FROM costume_photos
     WHERE costume_id = ? AND session_id = ?
     ORDER BY created_at ASC, id ASC`,
    costumeId,
    sessionId
  );
}

/** Pool photos with session date when known (ended trick-or-treat run), for gallery UI. */
export async function getCostumePhotosWithSessionMeta(
  db: SQLite.SQLiteDatabase,
  costumeId: number
): Promise<CostumePhotoWithSession[]> {
  return db.getAllAsync<CostumePhotoWithSession>(
    `SELECT cp.id, cp.costume_id, cp.session_id, cp.image_path, cp.created_at,
            s.started_at AS session_started_at
     FROM costume_photos cp
     LEFT JOIN sessions s ON s.id = cp.session_id
     WHERE cp.costume_id = ?
     ORDER BY datetime(cp.created_at) DESC, cp.id DESC`,
    costumeId
  );
}

export async function getCostumesWithPhotoCounts(
  db: SQLite.SQLiteDatabase,
  profileId: number
): Promise<CostumeWithPhotoCount[]> {
  return db.getAllAsync<CostumeWithPhotoCount>(
    `SELECT c.id, c.profile_id, c.name, c.image_path, c.created_at,
            COALESCE(COUNT(cp.id), 0) AS photo_count
     FROM costumes c
     LEFT JOIN costume_photos cp ON cp.costume_id = c.id
     WHERE c.profile_id = ?
     GROUP BY c.id
     ORDER BY c.created_at DESC`,
    profileId
  );
}

// Session CRUD
export async function createSession(
  db: SQLite.SQLiteDatabase,
  profileId: number,
  costumeId?: number | null,
  opts?: { name?: string | null; linkedSessionId?: number | null; sessionType?: string | null }
): Promise<number> {
  const startedAt = new Date().toISOString();
  const result = await db.runAsync(
    'INSERT INTO sessions (profile_id, costume_id, started_at, name, linked_session_id, session_type) VALUES (?, ?, ?, ?, ?, ?)',
    profileId,
    costumeId ?? null,
    startedAt,
    opts?.name ?? null,
    opts?.linkedSessionId ?? null,
    opts?.sessionType ?? null
  );
  return result.lastInsertRowId;
}

export async function updateSession(
  db: SQLite.SQLiteDatabase,
  sessionId: number,
  data: {
    name?: string | null;
    linkedSessionId?: number | null;
    costumeId?: number | null;
  }
): Promise<void> {
  if (data.name !== undefined) {
    await db.runAsync('UPDATE sessions SET name = ? WHERE id = ?', data.name, sessionId);
  }
  if (data.linkedSessionId !== undefined) {
    await db.runAsync(
      'UPDATE sessions SET linked_session_id = ? WHERE id = ?',
      data.linkedSessionId,
      sessionId
    );
  }
  if (data.costumeId !== undefined) {
    await db.runAsync(
      'UPDATE sessions SET costume_id = ? WHERE id = ?',
      data.costumeId,
      sessionId
    );
  }
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
    "SELECT * FROM sessions WHERE profile_id = ? AND ended_at IS NULL AND (session_type IS NULL OR session_type = 'trick_or_treat') ORDER BY started_at DESC LIMIT 1",
    profileId
  );
}

// Stash rounds (My Stash table) – only one row per profile with status 'in_progress'
export async function getCurrentStashRound(
  db: SQLite.SQLiteDatabase,
  profileId: number
): Promise<StashRound | null> {
  return db.getFirstAsync<StashRound>(
    "SELECT * FROM stash_rounds WHERE profile_id = ? AND status = 'in_progress' ORDER BY created_at DESC LIMIT 1",
    profileId
  );
}

/** Creates a new stash round with status 'in_progress'. Ensures only one in_progress by marking any existing one as done. Call after save & restart or when adding first candy and none exists. */
export async function createStashRound(
  db: SQLite.SQLiteDatabase,
  profileId: number
): Promise<number> {
  await db.runAsync(
    "UPDATE stash_rounds SET status = 'done', ended_at = datetime('now') WHERE profile_id = ? AND status = 'in_progress'",
    profileId
  );
  const result = await db.runAsync(
    "INSERT INTO stash_rounds (profile_id, status) VALUES (?, 'in_progress')",
    profileId
  );
  return result.lastInsertRowId;
}

export async function completeStashRound(
  db: SQLite.SQLiteDatabase,
  stashRoundId: number,
  data: { name?: string | null; linkedSessionId?: number | null }
): Promise<void> {
  const endedAt = new Date().toISOString();
  await db.runAsync(
    'UPDATE stash_rounds SET status = ?, name = ?, linked_session_id = ?, ended_at = ? WHERE id = ?',
    'done',
    data.name ?? null,
    data.linkedSessionId ?? null,
    endedAt,
    stashRoundId
  );
}

export async function updateStashRound(
  db: SQLite.SQLiteDatabase,
  stashRoundId: number,
  data: { linkedSessionId?: number | null }
): Promise<void> {
  if (data.linkedSessionId !== undefined) {
    await db.runAsync(
      'UPDATE stash_rounds SET linked_session_id = ? WHERE id = ?',
      data.linkedSessionId,
      stashRoundId
    );
  }
}

export async function getStashRounds(
  db: SQLite.SQLiteDatabase,
  profileId: number
): Promise<StashRound[]> {
  return db.getAllAsync<StashRound>(
    "SELECT * FROM stash_rounds WHERE profile_id = ? AND status = 'done' ORDER BY ended_at DESC, created_at DESC",
    profileId
  );
}

export async function getStashRoundStats(
  db: SQLite.SQLiteDatabase,
  stashRoundId: number
): Promise<{ candyCount: number }> {
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COALESCE(SUM(quantity), 0) as count FROM candy_logs WHERE stash_round_id = ?',
    stashRoundId
  );
  return { candyCount: row?.count ?? 0 };
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
    `SELECT s.* FROM sessions s
     WHERE s.ended_at IS NOT NULL
       AND (s.profile_id = ? OR s.id IN (SELECT session_id FROM session_shares WHERE profile_id = ?))
     ORDER BY s.started_at DESC`,
    profileId,
    profileId
  );
}

export async function addSessionShare(
  db: SQLite.SQLiteDatabase,
  sessionId: number,
  profileId: number
): Promise<void> {
  const session = await getSession(db, sessionId);
  if (!session || session.profile_id === profileId) return;
  await db.runAsync(
    'INSERT OR IGNORE INTO session_shares (session_id, profile_id) VALUES (?, ?)',
    sessionId,
    profileId
  );
}

export async function removeSessionShare(
  db: SQLite.SQLiteDatabase,
  sessionId: number,
  profileId: number
): Promise<void> {
  await db.runAsync(
    'DELETE FROM session_shares WHERE session_id = ? AND profile_id = ?',
    sessionId,
    profileId
  );
}

export async function getSessionSharedWithProfileIds(
  db: SQLite.SQLiteDatabase,
  sessionId: number
): Promise<number[]> {
  const rows = await db.getAllAsync<{ profile_id: number }>(
    'SELECT profile_id FROM session_shares WHERE session_id = ?',
    sessionId
  );
  return rows.map((r) => r.profile_id);
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

/** Remove a house visit from a session; unlink session candy from that house (keeps quantities). */
export async function removeHouseVisitFromSession(
  db: SQLite.SQLiteDatabase,
  sessionId: number,
  houseId: number
): Promise<void> {
  await db.runAsync(
    'DELETE FROM house_visits WHERE session_id = ? AND house_id = ?',
    sessionId,
    houseId
  );
  await db.runAsync(
    'UPDATE candy_logs SET house_id = NULL WHERE session_id = ? AND house_id = ?',
    sessionId,
    houseId
  );
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

/** Candy logs for a stash round (My Stash). */
export async function getCandyLogsForStashRound(
  db: SQLite.SQLiteDatabase,
  profileId: number,
  stashRoundId: number
): Promise<CandyLog[]> {
  return db.getAllAsync<CandyLog>(
    'SELECT * FROM candy_logs WHERE profile_id = ? AND stash_round_id = ? ORDER BY created_at DESC',
    profileId,
    stashRoundId
  );
}

/** Remove candy logs with quantity 0 for a stash round (e.g. after closing the log modal). */
export async function deleteZeroQuantityCandyLogsForStashRound(
  db: SQLite.SQLiteDatabase,
  stashRoundId: number
): Promise<void> {
  await db.runAsync(
    'DELETE FROM candy_logs WHERE stash_round_id = ? AND quantity = 0',
    stashRoundId
  );
}

/** Assign all current-round candy logs to a session (for save & restart). */
export async function assignCurrentRoundToSession(
  db: SQLite.SQLiteDatabase,
  profileId: number,
  sessionId: number
): Promise<void> {
  await db.runAsync(
    'UPDATE candy_logs SET session_id = ? WHERE profile_id = ? AND session_id IS NULL',
    sessionId,
    profileId
  );
}

export async function createCandyLog(
  db: SQLite.SQLiteDatabase,
  profileId: number,
  candyName: string,
  quantity: number,
  opts?: {
    sessionId?: number | null;
    stashRoundId?: number | null;
    houseId?: number | null;
    image_path?: string | null;
  }
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO candy_logs (profile_id, session_id, stash_round_id, house_id, candy_name, quantity, image_path) VALUES (?, ?, ?, ?, ?, ?, ?)',
    profileId,
    opts?.sessionId ?? null,
    opts?.stashRoundId ?? null,
    opts?.houseId ?? null,
    candyName,
    quantity,
    opts?.image_path ?? null
  );
  return result.lastInsertRowId;
}

export async function updateCandyLog(
  db: SQLite.SQLiteDatabase,
  id: number,
  data: Partial<Pick<CandyLog, 'candy_name' | 'quantity' | 'image_path' | 'is_favorite' | 'house_id'>>
): Promise<void> {
  if (data.candy_name !== undefined)
    await db.runAsync('UPDATE candy_logs SET candy_name = ? WHERE id = ?', data.candy_name, id);
  if (data.quantity !== undefined)
    await db.runAsync('UPDATE candy_logs SET quantity = ? WHERE id = ?', data.quantity, id);
  if (data.image_path !== undefined)
    await db.runAsync('UPDATE candy_logs SET image_path = ? WHERE id = ?', data.image_path, id);
  if (data.is_favorite !== undefined)
    await db.runAsync('UPDATE candy_logs SET is_favorite = ? WHERE id = ?', data.is_favorite, id);
  if (data.house_id !== undefined)
    await db.runAsync('UPDATE candy_logs SET house_id = ? WHERE id = ?', data.house_id, id);
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

// Candies reference table
export async function getCandies(
  db: SQLite.SQLiteDatabase,
  opts?: { category?: string; commonOnly?: boolean }
): Promise<Candy[]> {
  let query = 'SELECT * FROM candies WHERE 1=1';
  const params: (string | number)[] = [];
  if (opts?.category) {
    query += ' AND category = ?';
    params.push(opts.category);
  }
  if (opts?.commonOnly) {
    query += ' AND is_common = 1';
  }
  query += ' ORDER BY sort_order ASC, name ASC';
  return db.getAllAsync<Candy>(query, ...params);
}

export async function getCandyByName(
  db: SQLite.SQLiteDatabase,
  name: string
): Promise<Candy | null> {
  return db.getFirstAsync<Candy>('SELECT * FROM candies WHERE name = ?', name);
}

export async function createCandy(
  db: SQLite.SQLiteDatabase,
  data: {
    name: string;
    category: string;
    sort_order?: number;
    emoji?: string | null;
    is_common?: 0 | 1;
    image_path?: string | null;
  }
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO candies (name, category, sort_order, emoji, is_common, image_path) VALUES (?, ?, ?, ?, ?, ?)',
    data.name,
    data.category,
    data.sort_order ?? 999,
    data.emoji ?? null,
    data.is_common ?? 0,
    data.image_path ?? null
  );
  return result.lastInsertRowId;
}

export async function updateCandy(
  db: SQLite.SQLiteDatabase,
  id: number,
  data: Partial<Pick<Candy, 'name' | 'category' | 'sort_order' | 'emoji' | 'is_common' | 'image_path'>>
): Promise<void> {
  if (data.name !== undefined)
    await db.runAsync('UPDATE candies SET name = ? WHERE id = ?', data.name, id);
  if (data.category !== undefined)
    await db.runAsync('UPDATE candies SET category = ? WHERE id = ?', data.category, id);
  if (data.sort_order !== undefined)
    await db.runAsync('UPDATE candies SET sort_order = ? WHERE id = ?', data.sort_order, id);
  if (data.emoji !== undefined)
    await db.runAsync('UPDATE candies SET emoji = ? WHERE id = ?', data.emoji, id);
  if (data.is_common !== undefined)
    await db.runAsync('UPDATE candies SET is_common = ? WHERE id = ?', data.is_common, id);
  if (data.image_path !== undefined)
    await db.runAsync('UPDATE candies SET image_path = ? WHERE id = ?', data.image_path, id);
}
