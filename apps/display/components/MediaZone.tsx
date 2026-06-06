'use client';

import { useState } from 'react';
import { youtubeEmbed } from '@/lib/youtube';

/**
 * Left media zone. Priority:
 *   1. Local video file (NEXT_PUBLIC_BOARD_VIDEO, e.g. "/media/board.mp4")
 *      served by the box itself — works fully OFFLINE, no YouTube needed.
 *   2. YouTube URL from admin (fallback, needs internet).
 *   3. Branded placeholder.
 *
 * The local file is the recommended setup for the on-site box: drop an MP4 in
 * the box's media folder, nginx serves it at /media/. If the file is missing
 * (404 → <video> error) we automatically fall back to the YouTube embed.
 */
const LOCAL_VIDEO = process.env.NEXT_PUBLIC_BOARD_VIDEO || '';

export function MediaZone({ url }: { url?: string | null }) {
  const [videoFailed, setVideoFailed] = useState(false);
  const embed = youtubeEmbed(url);
  const useLocal = LOCAL_VIDEO && !videoFailed;

  return (
    <section
      className="relative overflow-hidden rounded-rxl bg-coal shadow-soft"
      style={{ gridColumn: 1, gridRow: 1 }}
    >
      {useLocal ? (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={LOCAL_VIDEO}
          autoPlay
          muted
          loop
          playsInline
          onError={() => setVideoFailed(true)}
        />
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
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-center text-white/90">
          <div className="flex h-20 w-20 items-center justify-center rounded-rlg bg-coral text-2xl font-bold shadow-coral">
            NP
          </div>
          <span className="text-2xl font-bold">Ájiniyaz atındaǵı NMPI</span>
          <span className="text-base text-white/60">Registrator ofisi</span>
        </div>
      )}
    </section>
  );
}
