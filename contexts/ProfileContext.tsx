import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Profile } from '@/types';
import Storage from 'expo-sqlite/kv-store';

const SELECTED_PROFILE_KEY = 'selectedProfileId';

interface ProfileContextValue {
  profile: Profile | null;
  profileId: number | null;
  setProfile: (profile: Profile | null) => void;
  loadStoredProfile: (opts: {
    getProfile: (id: number) => Promise<Profile | null>;
    getDefaultProfile?: () => Promise<Profile | null>;
  }) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfileState] = useState<Profile | null>(null);

  const setProfile = useCallback(async (p: Profile | null) => {
    setProfileState(p);
    if (p) {
      await Storage.setItem(SELECTED_PROFILE_KEY, String(p.id));
    } else {
      await Storage.removeItem(SELECTED_PROFILE_KEY);
    }
  }, []);

  const loadStoredProfile = useCallback(
    async (opts: {
      getProfile: (id: number) => Promise<Profile | null>;
      getDefaultProfile?: () => Promise<Profile | null>;
    }) => {
      try {
        let loaded = false;
        const stored = await Storage.getItem(SELECTED_PROFILE_KEY);
        if (stored) {
          const id = parseInt(stored, 10);
          if (!isNaN(id)) {
            const p = await opts.getProfile(id);
            if (p) {
              setProfileState(p);
              loaded = true;
            }
          }
        }
        if (!loaded && opts.getDefaultProfile) {
          const defaultProfile = await opts.getDefaultProfile();
          if (defaultProfile) {
            setProfileState(defaultProfile);
            await Storage.setItem(SELECTED_PROFILE_KEY, String(defaultProfile.id));
          }
        }
      } catch {
        // Ignore
      }
    },
    []
  );

  return (
    <ProfileContext.Provider
      value={{
        profile,
        profileId: profile?.id ?? null,
        setProfile,
        loadStoredProfile,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}
