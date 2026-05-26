/* eslint-disable @next/next/no-img-element */
import { UserRound } from "lucide-react";

import { cn, initials } from "@/lib/utils";

type CandidatePhotoProps = {
  src?: string | null;
  alt: string;
  className?: string;
  /**
   * CSS object-position (Tailwind supports arbitrary values like `object-[50%_20%]`).
   * Use a slightly top-biased crop for portrait headshots so the forehead isn't cut.
   */
  objectPositionClassName?: string;
};

export function CandidatePhoto({
  src,
  alt,
  className,
  objectPositionClassName = "object-center",
}: CandidatePhotoProps) {
  if (!src) {
    return (
      <div
        className={cn(
          "grid place-items-center rounded-md bg-secondary text-secondary-foreground",
          className,
        )}
      >
        <span className="sr-only">{alt}</span>
        {alt ? (
          <span className="text-sm font-semibold">{initials(alt)}</span>
        ) : (
          <UserRound className="size-5" />
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={cn(
        // Keep candidate photos consistently framed regardless of the original image size.
        // `object-cover` preserves aspect ratio and fills the box.
        "block h-full w-full rounded-md object-cover",
        // Most candidate photos are portrait headshots; a slightly top-biased crop avoids cutting the head.
        objectPositionClassName,
        className,
      )}
      loading="lazy"
    />
  );
}
