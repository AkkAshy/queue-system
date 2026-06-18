'use client';

import { useEffect, useRef, useState } from 'react';
import { youtubeEmbed } from '@/lib/youtube';

/**
 * Left media zone. Priority:
 *   1. Local video PLAYLIST — every video file in the box's media folder
 *      (NEXT_PUBLIC_BOARD_MEDIA_DIR, default "/media/"), played in order on a
 *      loop. Works fully OFFLINE. Drop 1+ files on the box — that's it.
 *   2. YouTube URL from admin (fallback, needs internet).
 *   3. Branded placeholder.
 *
 * The file list comes from nginx's JSON autoindex of the media folder (see
 * deploy/nginx/local.conf). Order is by filename, so name files 01-…, 02-… to
 * control the sequence. If the folder is empty / unreachable we fall back to
 * the YouTube embed automatically.
 */
const MEDIA_DIR = (process.env.NEXT_PUBLIC_BOARD_MEDIA_DIR || '/media/').replace(/\/?$/, '/');
const VIDEO_RE = /\.(mp4|webm|mov|m4v|ogg)$/i;

export function MediaZone({ url }: { url?: string | null }) {
  const [playlist, setPlaylist] = useState<string[] | null>(null); // null = still loading
  const [idx, setIdx] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const embed = youtubeEmbed(url);

  // Fetch the folder listing once on mount; build an ordered playlist.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(MEDIA_DIR, { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const entries: Array<{ name?: string; type?: string }> = await res.json();
        const files = entries
          .filter((e) => e?.type !== 'directory' && e?.name && VIDEO_RE.test(e.name))
          .map((e) => e.name as string)
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
          .map((name) => MEDIA_DIR + encodeURIComponent(name));
        if (alive) setPlaylist(files);
      } catch {
        if (alive) setPlaylist([]); // none → fall back to YouTube/placeholder
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Advance to the next clip when one ends (wraps around → endless loop).
  function next() {
    setIdx((i) => (playlist && playlist.length ? (i + 1) % playlist.length : 0));
  }

  const hasVideos = !!playlist && playlist.length > 0;
  const current = hasVideos ? playlist[idx % playlist.length] : null;

  return (
    <section
      className="relative overflow-hidden rounded-rxl bg-coal shadow-soft"
      style={{ gridColumn: 1, gridRow: 1 }}
    >
      {current ? (
        <video
          ref={videoRef}
          key={current}
          className="absolute inset-0 h-full w-full object-cover"
          src={current}
          autoPlay
          muted
          // Loop a single clip; for a real playlist advance on end.
          loop={playlist!.length === 1}
          playsInline
          onEnded={next}
          onError={next}
        />
      ) : playlist === null ? (
        // Still probing the folder — keep the dark surface (no flash).
        <div className="absolute inset-0" />
      ) : embed ? (
        <iframe
          key={embed}
          className="absolute inset-0 h-full w-full border-0"
          src={embed}
          allow="autoplay; encrypted-media"
          referrerPolicy="strict-origin-when-cross-origin"
          title="NMPI media"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-6 text-center text-white/90">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/logo.png`}
            alt="NMPI"
            className="h-56 w-56 rounded-full bg-white object-contain p-4 shadow-soft"
          />
          <span className="text-3xl font-bold">Ájiniyaz atındaǵı NMPI</span>
          <span className="text-lg text-white/60">Registrator ofisi</span>
        </div>
      )}
    </section>
  );
}
