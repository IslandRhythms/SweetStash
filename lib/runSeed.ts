import type * as SQLite from 'expo-sqlite';

import {
  CANDY_LOGS,
  COSTUMES,
  HOUSES,
  HOUSE_VISITS,
  LOCATION_POINTS,
  PROFILES,
  SESSIONS,
} from './seedData';

type Db = SQLite.SQLiteDatabase;

function toIso(msAgo: number): string {
  return new Date(Date.now() - msAgo).toISOString();
}

export async function runSeed(db: Db): Promise<void> {
  await db.execAsync('DELETE FROM candy_logs');
  await db.execAsync('DELETE FROM house_visits');
  await db.execAsync('DELETE FROM location_points');
  await db.execAsync('DELETE FROM sessions');
  await db.execAsync('DELETE FROM houses');
  await db.execAsync('DELETE FROM costumes');
  await db.execAsync('DELETE FROM profiles');

  const profileIds: number[] = [];
  for (const p of PROFILES) {
    const r = await db.runAsync(
      'INSERT INTO profiles (name, avatar_path) VALUES (?, ?)',
      p.name,
      p.avatar_path
    );
    profileIds.push(r.lastInsertRowId);
  }

  const costumeIds: number[] = [];
  for (const c of COSTUMES) {
    const r = await db.runAsync(
      'INSERT INTO costumes (profile_id, name, image_path) VALUES (?, ?, ?)',
      profileIds[c.profileIndex],
      c.name,
      c.image_path
    );
    costumeIds.push(r.lastInsertRowId);
  }

  const houseIdsByProfile: number[][] = [[], []];
  for (const h of HOUSES) {
    const r = await db.runAsync(
      'INSERT INTO houses (profile_id, name, latitude, longitude, notes, image_path) VALUES (?, ?, ?, ?, ?, ?)',
      profileIds[h.profileIndex],
      h.name,
      h.latitude,
      h.longitude,
      h.notes,
      h.image_path
    );
    houseIdsByProfile[h.profileIndex].push(r.lastInsertRowId);
  }

  const sessionIds: number[] = [];
  const sessionProfileIndices: number[] = [];
  for (const s of SESSIONS) {
    const startedMs = s.startedAtOffsetMinutes * 60 * 1000;
    const endedMs = startedMs - s.durationMinutes * 60 * 1000;
    const costumeId = s.costumeIndex >= 0 ? costumeIds[s.costumeIndex] : null;
    const r = await db.runAsync(
      'INSERT INTO sessions (profile_id, costume_id, started_at, ended_at) VALUES (?, ?, ?, ?)',
      profileIds[s.profileIndex],
      costumeId,
      toIso(startedMs),
      toIso(endedMs)
    );
    sessionIds.push(r.lastInsertRowId);
    sessionProfileIndices.push(s.profileIndex);
  }

  for (let i = 0; i < LOCATION_POINTS.length; i++) {
    const lp = LOCATION_POINTS[i];
    const sessionId = sessionIds[lp.sessionIndex];
    const ts = toIso((LOCATION_POINTS.length - i) * 60000);
    await db.runAsync(
      'INSERT INTO location_points (session_id, latitude, longitude, timestamp) VALUES (?, ?, ?, ?)',
      sessionId,
      lp.lat,
      lp.lng,
      ts
    );
  }

  for (const hv of HOUSE_VISITS) {
    const sessionId = sessionIds[hv.sessionIndex];
    const profileIdx = sessionProfileIndices[hv.sessionIndex];
    const houseId = houseIdsByProfile[profileIdx][hv.houseIndexInProfile];
    await db.runAsync(
      'INSERT INTO house_visits (session_id, house_id, visited_at) VALUES (?, ?, ?)',
      sessionId,
      houseId,
      toIso(60000)
    );
  }

  for (const c of CANDY_LOGS) {
    const sessionId = c.sessionIndex >= 0 ? sessionIds[c.sessionIndex] : null;
    await db.runAsync(
      'INSERT INTO candy_logs (profile_id, session_id, candy_name, quantity, image_path) VALUES (?, ?, ?, ?, ?)',
      profileIds[c.profileIndex],
      sessionId,
      c.candyName,
      c.quantity,
      null
    );
  }
}
