// Parse a YouTube URL (as configured in the admin app) into a video id and an
// autoplaying, muted, looping nocookie embed URL for the board's media zone.
// Accepts youtu.be/ID, watch?v=ID and /embed/ID forms.

export function youtubeId(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    let id = '';
    if (u.hostname.includes('youtu.be')) id = u.pathname.slice(1);
    else if (u.searchParams.get('v')) id = u.searchParams.get('v') as string;
    else if (u.pathname.includes('/embed/')) id = u.pathname.split('/embed/')[1] ?? '';
    id = (id.split('/')[0] ?? '').trim();
    return id || null;
  } catch {
    return null;
  }
}

export function youtubeEmbed(url: string | undefined | null): string | null {
  const id = youtubeId(url);
  if (!id) return null;
  const p = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    controls: '0',
    loop: '1',
    playlist: id,
    modestbranding: '1',
    rel: '0',
    playsinline: '1',
  });
  return `https://www.youtube-nocookie.com/embed/${id}?${p.toString()}`;
}
