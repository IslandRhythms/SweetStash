/** Seed data for testing all app features. */

export const PROFILES = [
  { name: 'Maya', avatar_path: null },
  { name: 'Jake', avatar_path: null },
] as const;

export const COSTUMES = [
  { profileIndex: 0, name: 'Witch', image_path: null },
  { profileIndex: 0, name: 'Ghost', image_path: null },
  { profileIndex: 1, name: 'Pirate', image_path: null },
] as const;

export const HOUSES = [
  { profileIndex: 0, name: 'Smith House', latitude: 37.7749, longitude: -122.4194, notes: 'Great decorations!', image_path: null },
  { profileIndex: 0, name: 'Jones Home', latitude: 37.7755, longitude: -122.4188, notes: null, image_path: null },
  { profileIndex: 0, name: 'The Browns', latitude: 37.7761, longitude: -122.4202, notes: 'Full-size candy bars', image_path: null },
  { profileIndex: 1, name: 'Brown Residence', latitude: 37.7745, longitude: -122.4190, notes: null, image_path: null },
] as const;

/** Sessions: profileIndex, costumeIndex (-1 = none), startedAt offset (minutes ago), duration (minutes) */
export const SESSIONS = [
  { profileIndex: 0, costumeIndex: 0, startedAtOffsetMinutes: 720, durationMinutes: 45 },
  { profileIndex: 0, costumeIndex: 1, startedAtOffsetMinutes: 1440, durationMinutes: 30 },
  { profileIndex: 1, costumeIndex: 2, startedAtOffsetMinutes: 2880, durationMinutes: 60 },
] as const;

/** Location points: sessionIndex, lat, lng (small offsets from house coords) */
export const LOCATION_POINTS = [
  { sessionIndex: 0, lat: 37.7749, lng: -122.4194 },
  { sessionIndex: 0, lat: 37.7755, lng: -122.4188 },
  { sessionIndex: 0, lat: 37.7761, lng: -122.4202 },
  { sessionIndex: 0, lat: 37.7745, lng: -122.4190 },
  { sessionIndex: 1, lat: 37.7749, lng: -122.4194 },
  { sessionIndex: 1, lat: 37.7755, lng: -122.4188 },
  { sessionIndex: 2, lat: 37.7745, lng: -122.4190 },
  { sessionIndex: 2, lat: 37.7750, lng: -122.4185 },
] as const;

/** House visits: sessionIndex, houseIndex (in houses for that profile) */
export const HOUSE_VISITS = [
  { sessionIndex: 0, houseIndexInProfile: 0 },
  { sessionIndex: 0, houseIndexInProfile: 1 },
  { sessionIndex: 0, houseIndexInProfile: 2 },
  { sessionIndex: 1, houseIndexInProfile: 0 },
  { sessionIndex: 1, houseIndexInProfile: 1 },
  { sessionIndex: 2, houseIndexInProfile: 0 },
] as const;

/** Candy: profileIndex, sessionIndex (-1 = standalone), houseIndexInVisit (-1 = other), candyName, quantity */
export const CANDY_LOGS = [
  { profileIndex: 0, sessionIndex: 0, houseIndexInVisit: 0, candyName: 'Snickers', quantity: 3 },
  { profileIndex: 0, sessionIndex: 0, houseIndexInVisit: 0, candyName: "Reese's Cups", quantity: 2 },
  { profileIndex: 0, sessionIndex: 0, houseIndexInVisit: 1, candyName: 'M&Ms', quantity: 5 },
  { profileIndex: 0, sessionIndex: 0, houseIndexInVisit: 2, candyName: 'Skittles', quantity: 1 },
  { profileIndex: 0, sessionIndex: 1, houseIndexInVisit: 0, candyName: 'Kit Kat', quantity: 2 },
  { profileIndex: 0, sessionIndex: 1, houseIndexInVisit: 1, candyName: 'Twix', quantity: 2 },
  { profileIndex: 1, sessionIndex: 2, houseIndexInVisit: 0, candyName: 'Snickers', quantity: 4 },
  { profileIndex: 1, sessionIndex: 2, houseIndexInVisit: 0, candyName: 'Starburst', quantity: 3 },
  { profileIndex: 0, sessionIndex: -1, houseIndexInVisit: -1, candyName: 'Lollipop', quantity: 1 },
  { profileIndex: 1, sessionIndex: -1, houseIndexInVisit: -1, candyName: 'Gummy Bears', quantity: 2 },
] as const;
