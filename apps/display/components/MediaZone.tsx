'use client';

import { youtubeEmbed } from '@/lib/youtube';

/**
 * Left media zone — plays the YouTube URL configured in the admin app.
 * Accepts youtu.be/ID, watch?v=ID and /embed/ID forms. Falls back to a
 * branded placeholder when no (valid) URL is set.
 */
export function MediaZone({ url }: { url?: string | null }) {
  const embed = youtubeEmbed(url);

  return (
    <section
      className="relative overflow-hidden rounded-rxl bg-coal shadow-soft"
      style={{ gridColumn: 1, gridRow: 1 }}
    >
      {embed ? (
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
