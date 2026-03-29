export interface Profile {
  id: number;
  name: string;
  avatar_path: string | null;
  created_at: string;
}

export interface Costume {
  id: number;
  profile_id: number;
  name: string;
  image_path: string | null;
  created_at: string;
}

/** One of possibly many photos for a reused costume over time. */
export interface CostumePhoto {
  id: number;
  costume_id: number;
  session_id: number | null;
  image_path: string;
  created_at: string;
}

/** Pool row with optional linked session date (for Costumes gallery). */
export interface CostumePhotoWithSession extends CostumePhoto {
  session_started_at: string | null;
}

export type CostumeWithPhotoCount = Costume & { photo_count: number };

export interface Session {
  id: number;
  profile_id: number;
  costume_id: number | null;
  started_at: string;
  ended_at: string | null;
  name: string | null;
  linked_session_id: number | null;
  session_type: string | null;
}

export type StashRoundStatus = 'in_progress' | 'done';

export interface StashRound {
  id: number;
  profile_id: number;
  status: StashRoundStatus;
  name: string | null;
  linked_session_id: number | null;
  created_at: string;
  ended_at: string | null;
}

export interface LocationPoint {
  id: number;
  session_id: number;
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface House {
  id: number;
  profile_id: number;
  name: string;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  image_path: string | null;
  created_at: string;
  is_favorite?: 0 | 1;
}

export interface HouseVisit {
  id: number;
  session_id: number;
  house_id: number;
  visited_at: string;
}

export interface Candy {
  id: number;
  name: string;
  category: string;
  sort_order: number;
  emoji: string | null;
  is_common: 0 | 1;
  image_path: string | null;
}

export interface CandyLog {
  id: number;
  profile_id: number;
  session_id: number | null;
  stash_round_id: number | null;
  house_id: number | null;
  candy_name: string;
  quantity: number;
  image_path: string | null;
  created_at: string;
  is_favorite?: 0 | 1;
}
