import { Play } from 'lucide-react';

export interface MediaThumb {
  id: string;
  kind: 'photo' | 'video' | 'document';
  url: string | null;
}

/** Signed private-bucket media for one inspection item. */
export function MediaThumbs({ media }: { media: MediaThumb[] }) {
  if (!media.length) return null;
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {media.map((item) => (
        <li key={item.id} className="relative aspect-square overflow-hidden rounded-sm border border-line bg-gunmetal">
          {!item.url ? (
            <span className="grid size-full place-items-center text-xs text-steel">Unavailable</span>
          ) : item.kind === 'video' ? (
            <>
              <video src={item.url} width={240} height={240} preload="metadata" controls playsInline className="size-full object-cover" aria-label="Inspection video" />
              <Play className="pointer-events-none absolute left-1.5 top-1.5 size-4 text-chalk drop-shadow" aria-hidden="true" />
            </>
          ) : (
            <a href={item.url} target="_blank" rel="noreferrer" className="block size-full">
              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from a private bucket; next/image would cache and re-host it */}
              <img src={item.url} alt="Inspection photo" width={240} height={240} loading="lazy" className="size-full object-cover transition-transform hover:scale-105" />
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
