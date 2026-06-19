'use client';

// TEMP диагностика Chromium 84 (X96): ловит ошибку в root layout.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return (
    <html>
      <body style={{ padding: 24, fontFamily: 'monospace', color: '#000', background: '#fff' }}>
        <h1 style={{ fontSize: 28, color: '#c00' }}>TABLO global error</h1>
        <p style={{ fontSize: 22 }}>
          <b>
            {error?.name}: {error?.message}
          </b>
        </p>
        {error?.digest && <p style={{ fontSize: 16 }}>digest: {error.digest}</p>}
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{error?.stack}</pre>
      </body>
    </html>
  );
}
