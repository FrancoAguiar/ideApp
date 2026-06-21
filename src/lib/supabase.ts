export type Idea = {
  id: string;
  user_id?: string | null;
  title: string;
  original_text: string;
  corrected_text: string;
  summary: string;
  month: string;
  status: string;
  is_favorite?: boolean;
  is_pinned?: boolean;
  created_at: string;
};

export type CreateIdeaInput = Omit<Idea, "id" | "created_at"> & {
  created_at?: string;
};

export type UpdateIdeaInput = Partial<Omit<Idea, "id">>;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

function getSupabaseConfig() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase is not configured");
  }

  return {
    url: supabaseUrl.replace(/\/$/, ""),
    anonKey: supabaseAnonKey,
  };
}

async function requestSupabase<T>(path: string, init?: RequestInit) {
  const { url, anonKey } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
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

    throw new Error(
      `Supabase request failed: ${response.status} ${response.statusText}${responseBody ? ` - ${responseBody}` : ""}`,
    );
  }

  if (response.status === 204 || !responseBody) {
    return null as T;
  }

  return JSON.parse(responseBody) as T;
}

export async function getIdeas() {
  return requestSupabase<Idea[]>("ideas?select=*&order=created_at.desc");
}

export async function createIdea(idea: CreateIdeaInput) {
  const payload = {
    user_id: idea.user_id ?? null,
    title: idea.title,
    original_text: idea.original_text,
    corrected_text: idea.corrected_text,
    summary: idea.summary,
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

export async function updateIdea(id: string, idea: UpdateIdeaInput) {
  const data = await requestSupabase<Idea[]>(`ideas?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(idea),
  });

  if (!data[0]) throw new Error("Supabase did not return the updated idea");
  return data[0];
}

export async function deleteIdea(id: string) {
  await requestSupabase<null>(`ideas?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
