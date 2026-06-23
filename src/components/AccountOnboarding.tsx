"use client";

import { useState, type FormEvent } from "react";
import { updateUserProfile, type UserProfile } from "@/lib/supabase";

export default function AccountOnboarding({
  userId,
  onComplete,
}: {
  userId: string;
  onComplete: (profile: UserProfile) => void;
}) {
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim().replace(/\s+/g, " ");

    if (cleanName.length < 2 || cleanName.length > 40) {
      setError("Escribí un nombre válido.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const profile = await updateUserProfile(userId, {
        full_name: cleanName,
        onboarding_completed: true,
      });
      onComplete(profile);
    } catch {
      setError("No pudimos guardar tu nombre. Probá de nuevo.");
    } finally {
      setIsSaving(false);
    }
  }

  const cleanName = name.trim();

  return (
    <main className="onboarding-screen">
      <section className="onboarding-panel">
        <p className="onboarding-brand">IdeApp</p>
        <h1>Terminemos tu cuenta</h1>
        <p className="onboarding-subtitle">Así IdeApp puede ordenar tus ideas de forma más personal.</p>

        <form onSubmit={submitName}>
          <label htmlFor="account-name">Nombre</label>
          <input
            id="account-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (error) setError(null);
            }}
            placeholder="Ej: Franco"
            maxLength={40}
            autoFocus
          />
          <button type="submit" disabled={isSaving || cleanName.length < 2}>
            {isSaving ? "Guardando…" : "Entrar a IdeApp"}
          </button>
        </form>

        <p className={`account-form-error ${error ? "show" : ""}`} role="alert">
          {error || ""}
        </p>
      </section>
    </main>
  );
}
