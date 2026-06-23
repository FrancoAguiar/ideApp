export const LOCAL_PROFILE_STORAGE_KEY = "ideapp_local_profile";

export type LocalProfile = {
  fullName: string;
  createdAt: string;
};

export function readLocalProfile() {
  try {
    const rawProfile = window.localStorage.getItem(LOCAL_PROFILE_STORAGE_KEY);
    if (!rawProfile) return null;

    const profile: unknown = JSON.parse(rawProfile);
    if (!profile || typeof profile !== "object") return null;

    const value = profile as Record<string, unknown>;
    if (typeof value.fullName !== "string" || typeof value.createdAt !== "string") return null;

    const fullName = value.fullName.trim().replace(/\s+/g, " ");
    if (fullName.length < 2 || fullName.length > 40) return null;
    return { fullName, createdAt: value.createdAt } satisfies LocalProfile;
  } catch {
    return null;
  }
}

export function saveLocalProfile(fullName: string, existingProfile?: LocalProfile | null) {
  const profile: LocalProfile = {
    fullName: fullName.trim().replace(/\s+/g, " "),
    createdAt: existingProfile?.createdAt ?? new Date().toISOString(),
  };

  window.localStorage.setItem(LOCAL_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  return profile;
}
