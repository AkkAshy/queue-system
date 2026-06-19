'use client';

// TEMP диагностика Chromium 84 (X96): показываем настоящую причину вместо
// дефолтного «Application error». Убрать после диагностики.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        padding: 24,
        fontFamily: 'monospace',
        color: '#000',
        background: '#fff',
        height: '100vh',
        overflowY: 'auto',
      }}
    >
      <h1 style={{ fontSize: 28, color: '#c00', margin: '0 0 12px' }}>TABLO error</h1>
      <p style={{ fontSize: 22 }}>
        <b>
          {error?.name}: {error?.message}
        </b>
      </p>
      {error?.digest && <p style={{ fontSize: 16 }}>digest: {error.digest}</p>}
      <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, marginTop: 16 }}>{error?.stack}</pre>
      <button onClick={reset} style={{ marginTop: 16, fontSize: 20, padding: '8px 18px' }}>
        reload
      </button>
    </div>
  );
}
