"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Package } from "lucide-react";
import { thumbUrl } from "@/lib/storage";
import { cn } from "@/lib/cn";

// Swipeable photo gallery: swipe on phones, arrows and thumbnails on computers
export function Gallery({ images, name }: { images: { url: string; alt: string | null }[]; name: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-2xl bg-surface text-muted ring-1 ring-line">
        <Package className="h-12 w-12" aria-hidden="true" />
      </div>
    );
  }

  const goTo = (i: number) => {
    const el = track.current;
    if (!el) return;
    const n = (i + images.length) % images.length;
    el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
    setIndex(n);
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <div
          ref={track}
          className="flex aspect-square snap-x snap-mandatory overflow-x-auto rounded-2xl bg-surface ring-1 ring-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={(e) => {
            const el = e.currentTarget;
            const i = Math.round(el.scrollLeft / el.clientWidth);
            if (i !== index) setIndex(i);
          }}
          aria-label={`${name} photos`}
          aria-roledescription="carousel"
        >
          {images.map((img, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={img.url}
              src={img.url}
              alt={img.alt || (images.length > 1 ? `${name}, photo ${i + 1} of ${images.length}` : name)}
              loading={i === 0 ? "eager" : "lazy"}
              width={1200}
              height={1200}
              className="h-full w-full shrink-0 snap-center object-contain"
            />
          ))}
        </div>
        {images.length > 1 && (
          <>
            <button type="button" onClick={() => goTo(index - 1)} className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-surface/90 p-2 shadow hover:bg-surface sm:block" aria-label="Previous photo">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => goTo(index + 1)} className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-surface/90 p-2 shadow hover:bg-surface sm:block" aria-label="Next photo">
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 sm:hidden" aria-hidden="true">
              {images.map((img, i) => (
                <span key={img.url} className={cn("h-1.5 rounded-full transition-all", i === index ? "w-4 bg-ink/80" : "w-1.5 bg-ink/30")} />
              ))}
            </div>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="hidden gap-2 sm:flex">
          {images.map((img, i) => (
            <button
              key={img.url}
              type="button"
              onClick={() => goTo(i)}
              className={cn("h-16 w-16 overflow-hidden rounded-lg ring-2 transition", i === index ? "ring-(--store)" : "ring-transparent opacity-70 hover:opacity-100")}
              aria-label={`Show photo ${i + 1}`}
              aria-current={i === index}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumbUrl(img.url)} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
