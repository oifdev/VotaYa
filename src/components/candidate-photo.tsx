/* eslint-disable @next/next/no-img-element */
import { UserRound } from "lucide-react";

import { cn, initials } from "@/lib/utils";

type CandidatePhotoProps = {
  src?: string | null;
  alt: string;
  className?: string;
};

export function CandidatePhoto({ src, alt, className }: CandidatePhotoProps) {
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
      className={cn("rounded-md object-cover", className)}
      loading="lazy"
    />
  );
}
