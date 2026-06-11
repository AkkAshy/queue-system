/**
 * UUID v4 that works in NON-secure contexts (plain HTTP on a LAN IP).
 *
 * `crypto.randomUUID()` is only defined in a secure context (HTTPS or
 * localhost). The on-site box serves the kiosk over http://<LAN-IP>/, so
 * `crypto.randomUUID` is undefined there → calling it throws. `getRandomValues`
 * IS available over HTTP, so we use it; Math.random is the last-resort fallback.
 */
export function safeUUID(): string {
  const c: Crypto | undefined = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();

  const rnd = (): number => {
    if (c && typeof c.getRandomValues === 'function') {
      return c.getRandomValues(new Uint8Array(1))[0] ?? 0;
    }
    return Math.floor(Math.random() * 256);
  };

  // RFC 4122 v4 via a template; each 0/1/8 placeholder → random hex nibble.
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (ch) => {
    const n = Number(ch);
    return (n ^ (rnd() & (15 >> (n / 4)))).toString(16);
  });
}
