import Image from "next/image";
import { CookingPot } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  src: string | null;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
};

/** Recipe photo with a fixed 4:3 frame, or a neutral placeholder when there is none. */
export function RecipeImage({ src, alt, sizes, priority, className }: Props) {
  return (
    <div className={cn("relative aspect-[4/3] overflow-hidden bg-muted", className)}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <CookingPot className="size-10" aria-hidden="true" />
          <span className="sr-only">No photo</span>
        </div>
      )}
    </div>
  );
}
