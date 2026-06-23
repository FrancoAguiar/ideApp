"use client";

import { useState, type FormEvent } from "react";
import {
  updateUserProfile,
  type AuthUser,
  type UserProfile,
} from "@/lib/supabase";

export default function AccountSettings({
  user,
  profile,
  onProfileUpdated,
  onSignOut,
}: {
  user: AuthUser;
  profile: UserProfile;
  onProfileUpdated: (profile: UserProfile) => void;
  onSignOut: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(profile.full_name ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cancelEditing() {
    setName(profile.full_name ?? "");
    setError(null);
    setIsEditing(false);
  }

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim().replace(/\s+/g, " ");
    if (cleanName.length < 2 || cleanName.length > 40) {
      setError("Escribí un nombre válido.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const updatedProfile = await updateUserProfile(user.id, { full_name: cleanName });
      onProfileUpdated(updatedProfile);
      setName(updatedProfile.full_name ?? cleanName);
      setIsEditing(false);
    } catch {
      setError("No pudimos guardar el nombre. Probá de nuevo.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="account-settings" aria-labelledby="account-settings-title">
      <div className="section-head">
        <h2 className="section-title" id="account-settings-title">Cuenta</h2>
      </div>

      <div className="account-settings-card">
        {isEditing ? (
          <form className="account-name-form" onSubmit={saveName}>
            <label htmlFor="settings-account-name">Nombre</label>
            <input
              id="settings-account-name"
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
              <button type="submit" className="account-save" disabled={isSaving}>
                {isSaving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="account-detail">
              <span>Nombre</span>
              <strong>{profile.full_name}</strong>
            </div>
            <div className="account-detail">
              <span>Email</span>
              <strong>{user.email ?? profile.email ?? "Sin email"}</strong>
            </div>
            <button type="button" className="account-edit" onClick={() => setIsEditing(true)}>
              Editar nombre
            </button>
          </>
        )}
      </div>

      <button type="button" className="account-signout" onClick={onSignOut}>Cerrar sesión</button>
    </section>
  );
}
