export type AuthUser = {
  id: string;
  email?: string;
};

export type Idea = {
  id: string;
  user_id?: string | null;
  title: string;
  original_text: string;
  corrected_text: string;
  summary: string;
  category?: string | null;
  month: string;
  status: string;
  is_favorite?: boolean;
  is_pinned?: boolean;
  created_at: string;
};

export type CreateIdeaInput = Omit<Idea, "id" | "created_at"> & {
  created_at?: string;
};

export type UpdateIdeaInput = Partial<Omit<Idea, "id" | "user_id">>;

type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user?: AuthUser;
};

const AUTH_STORAGE_KEY = "ideapp_supabase_auth";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const authListeners = new Set<(user: AuthUser | null) => void>();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

function getSupabaseConfig() {
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase is not configured");
  return { url: supabaseUrl.replace(/\/$/, ""), anonKey: supabaseAnonKey };
}

function readSession() {
  if (typeof window === "undefined") return null;

  try {
    const rawSession = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return rawSession ? (JSON.parse(rawSession) as AuthSession) : null;
  } catch {
    return null;
  }
}

function writeSession(session: AuthSession | null) {
  if (typeof window === "undefined") return;

  try {
    if (session) window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Auth still works for the current page when storage is unavailable.
  }
}

function emitAuthChange(user: AuthUser | null) {
  authListeners.forEach((listener) => listener(user));
}

function parseAuthCallback() {
  if (typeof window === "undefined" || !window.location.hash) return null;

  const params = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return null;

  const expiresIn = Number(params.get("expires_in") || 3600);
  const session: AuthSession = {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
  };

  writeSession(session);
  window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
  return session;
}

async function refreshSession(session: AuthSession) {
  const { url, anonKey } = getSupabaseConfig();
  const response = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });

  if (!response.ok) {
    writeSession(null);
    emitAuthChange(null);
    throw new Error(`Supabase session refresh failed: ${response.status}`);
  }

  const refreshed = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user?: AuthUser;
  };
  const nextSession: AuthSession = {
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + refreshed.expires_in,
    user: refreshed.user ?? session.user,
  };

  writeSession(nextSession);
  return nextSession;
}

async function getValidSession() {
  const session = parseAuthCallback() ?? readSession();
  if (!session) return null;

  const expiresSoon = session.expires_at <= Math.floor(Date.now() / 1000) + 60;
  return expiresSoon ? refreshSession(session) : session;
}

async function requestAuthUser(session: AuthSession) {
  const { url, anonKey } = getSupabaseConfig();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (!response.ok) throw new Error(`Supabase user request failed: ${response.status}`);
  return (await response.json()) as AuthUser;
}

export async function getCurrentUser() {
  if (!isSupabaseConfigured) return null;

  const session = await getValidSession();
  if (!session) return null;

  try {
    const user = await requestAuthUser(session);
    writeSession({ ...session, user });
    emitAuthChange(user);
    return user;
  } catch (error) {
    console.error("Failed to get current Supabase user", error);
    writeSession(null);
    emitAuthChange(null);
    return null;
  }
}

export async function signInWithMagicLink(email: string) {
  const { url, anonKey } = getSupabaseConfig();
  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/` : "";
  const response = await fetch(`${url}/auth/v1/otp?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, create_user: true }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("Failed to send Supabase magic link", { status: response.status, body });
    throw new Error("Supabase magic link request failed");
  }
}

export async function signOut() {
  const session = readSession();

  try {
    if (session) {
      const { url, anonKey } = getSupabaseConfig();
      const response = await fetch(`${url}/auth/v1/logout`, {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok && response.status !== 401) {
        throw new Error(`Supabase sign out failed: ${response.status}`);
      }
    }
  } finally {
    writeSession(null);
    emitAuthChange(null);
  }
}

export function listenToAuthChanges(callback: (user: AuthUser | null) => void) {
  authListeners.add(callback);

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== AUTH_STORAGE_KEY) return;
    callback(readSession()?.user ?? null);
  };

  if (typeof window !== "undefined") window.addEventListener("storage", handleStorage);
  return () => {
    authListeners.delete(callback);
    if (typeof window !== "undefined") window.removeEventListener("storage", handleStorage);
  };
}

async function requestSupabase<T>(path: string, init?: RequestInit) {
  const { url, anonKey } = getSupabaseConfig();
  const session = await getValidSession();
  if (!session) throw new Error("Supabase authentication is required");

  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...init?.headers,
    },
  });
  const responseBody = await response.text();

  if (!response.ok) {
    console.error("Supabase request failed", {
      status: response.status,
      statusText: response.statusText,
      body: responseBody,
    });
    throw new Error(`Supabase request failed: ${response.status} ${response.statusText}`);
  }

  if (response.status === 204 || !responseBody) return null as T;
  return JSON.parse(responseBody) as T;
}

export async function getIdeas(userId: string) {
  const query = `ideas?select=*&user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`;
  return requestSupabase<Idea[]>(query);
}

export async function createIdea(idea: CreateIdeaInput) {
  if (!idea.user_id) throw new Error("Authenticated user_id is required to create an idea");

  const payload = {
    user_id: idea.user_id,
    title: idea.title,
    original_text: idea.original_text,
    corrected_text: idea.corrected_text,
    summary: idea.summary,
    category: idea.category ?? "Random",
    month: idea.month,
    status: idea.status,
    is_favorite: idea.is_favorite ?? false,
    is_pinned: idea.is_pinned ?? false,
    created_at: idea.created_at,
  } satisfies CreateIdeaInput;

  const data = await requestSupabase<Idea[]>("ideas", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!data[0]) throw new Error("Supabase did not return the created idea");
  return data[0];
}

export async function updateIdea(id: string, userId: string, idea: UpdateIdeaInput) {
  const path = `ideas?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`;
  const data = await requestSupabase<Idea[]>(path, {
    method: "PATCH",
    body: JSON.stringify(idea),
  });
  if (!data[0]) throw new Error("Supabase did not return the updated idea");
  return data[0];
}

export async function deleteIdea(id: string, userId: string) {
  const path = `ideas?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`;
  await requestSupabase<null>(path, { method: "DELETE" });
}
