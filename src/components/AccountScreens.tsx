"use client";

export function AccountLoadingScreen({ message }: { message: string }) {
  return (
    <main className="account-state-screen" aria-live="polite">
      <div className="account-state-mark" aria-hidden="true">💡</div>
      <p>{message}</p>
    </main>
  );
}

export function AccountErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="account-state-screen">
      <div className="account-error-panel">
        <h1>No pudimos cargar tu cuenta.</h1>
        <button type="button" onClick={onRetry}>Reintentar</button>
      </div>
    </main>
  );
}
