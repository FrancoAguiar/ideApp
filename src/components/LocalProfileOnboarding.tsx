"use client";

import { useState, type FormEvent } from "react";
import { saveLocalProfile, type LocalProfile } from "@/lib/local-profile";

export default function LocalProfileOnboarding({
  onComplete,
}: {
  onComplete: (profile: LocalProfile) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submitName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim().replace(/\s+/g, " ");
    if (cleanName.length < 2 || cleanName.length > 40) {
      setError("Escribí un nombre válido.");
      return;
    }

    try {
      onComplete(saveLocalProfile(cleanName));
    } catch {
      setError("No pudimos guardar tu nombre. Probá de nuevo.");
    }
  }

  return (
    <main className="onboarding-screen">
      <section className="onboarding-panel">
        <p className="onboarding-brand">IdeApp</p>
        <h1>¿Cómo querés que te llamemos?</h1>
        <p className="onboarding-subtitle">Vamos a personalizar IdeApp para vos.</p>

        <form onSubmit={submitName}>
          <label htmlFor="local-profile-name">Tu nombre</label>
          <input
            id="local-profile-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (error) setError(null);
            }}
            maxLength={40}
            autoFocus
          />
          <button type="submit">Continuar</button>
        </form>

        <p className={`account-form-error ${error ? "show" : ""}`} role="alert">{error || ""}</p>
      </section>
    </main>
  );
}
