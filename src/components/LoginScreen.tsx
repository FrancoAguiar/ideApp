"use client";

import { useState, type FormEvent } from "react";
import { signInWithMagicLink } from "@/lib/supabase";

function LoginBulbIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18.5h6" />
      <path d="M10 21h4" />
      <path d="M8.5 15.2c-1.7-1.2-2.8-3.1-2.8-5.3A6.3 6.3 0 0 1 12 3.6a6.3 6.3 0 0 1 6.3 6.3c0 2.2-1.1 4.1-2.8 5.3-.6.4-.9 1-.9 1.7v.1H9.4v-.1c0-.7-.3-1.3-.9-1.7Z" />
    </svg>
  );
}

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || status === "loading") return;

    setStatus("loading");
    try {
      await signInWithMagicLink(email.trim());
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  return (
    <main className="login-screen" aria-label="Acceso a IdeApp">
      <section className="login-panel">
        <div className="login-brand" aria-hidden="true"><LoginBulbIcon /></div>
        <p className="login-name">IdeApp</p>
        <h1>Entrá a IdeApp</h1>
        <p className="login-subtitle">Guardá tus ideas y volvé a encontrarlas cuando las necesites.</p>

        <form className="login-form" onSubmit={submitLogin}>
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (status === "error") setStatus("idle");
            }}
            placeholder="tu@email.com"
            required
            disabled={status === "loading" || status === "success"}
          />
          <button type="submit" disabled={status === "loading" || status === "success"}>
            {status === "loading" ? "Enviando link…" : "Enviar link de acceso"}
          </button>
        </form>

        <p className={`login-message ${status === "success" || status === "error" ? "show" : ""}`} role="status" aria-live="polite">
          {status === "success"
            ? "Te mandamos un link de acceso. Revisá tu email."
            : status === "error"
              ? "No pudimos enviar el link. Probá de nuevo."
              : ""}
        </p>
      </section>
    </main>
  );
}
