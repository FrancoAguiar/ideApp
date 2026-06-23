"use client";

import { useState, type FormEvent } from "react";
import { saveLocalProfile, type LocalProfile } from "@/lib/local-profile";

export default function LocalAccountSettings({
  profile,
  onProfileUpdated,
}: {
  profile: LocalProfile;
  onProfileUpdated: (profile: LocalProfile) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(profile.fullName);
  const [error, setError] = useState<string | null>(null);

  function cancelEditing() {
    setName(profile.fullName);
    setError(null);
    setIsEditing(false);
  }

  function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim().replace(/\s+/g, " ");
    if (cleanName.length < 2 || cleanName.length > 40) {
      setError("Escribí un nombre válido.");
      return;
    }

    try {
      const updatedProfile = saveLocalProfile(cleanName, profile);
      onProfileUpdated(updatedProfile);
      setName(updatedProfile.fullName);
      setIsEditing(false);
    } catch {
      setError("No pudimos guardar el nombre. Probá de nuevo.");
    }
  }

  return (
    <section className="account-settings" aria-labelledby="local-account-title">
      <div className="section-head">
        <h2 className="section-title" id="local-account-title">Cuenta</h2>
      </div>
      <div className="account-settings-card">
        {isEditing ? (
          <form className="account-name-form" onSubmit={saveName}>
            <label htmlFor="local-settings-name">Nombre</label>
            <input
              id="local-settings-name"
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
            <p className={`account-form-error ${error ? "show" : ""}`} role="alert">{error || ""}</p>
            <div className="account-form-actions">
              <button type="button" className="account-cancel" onClick={cancelEditing}>Cancelar</button>
              <button type="submit" className="account-save">Guardar</button>
            </div>
          </form>
        ) : (
          <>
            <div className="account-detail">
              <span>Nombre</span>
              <strong>{profile.fullName}</strong>
            </div>
            <button type="button" className="account-edit" onClick={() => setIsEditing(true)}>
              Editar nombre
            </button>
          </>
        )}
      </div>
    </section>
  );
}
