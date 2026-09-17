"use client";

import { useEffect, useRef } from "react";

import type { KeyboardEvent } from "react";

const MIN_THUMB_PX = 48;

function handleTrackKeyDown(e: KeyboardEvent<HTMLDivElement>) {
  const el = document.documentElement;
  const page = el.clientHeight;
  switch (e.key) {
    case "ArrowDown":
      el.scrollTop += 40;
      break;
    case "ArrowUp":
      el.scrollTop -= 40;
      break;
    case "PageDown":
      el.scrollTop += page;
      break;
    case "PageUp":
      el.scrollTop -= page;
      break;
    case "Home":
      el.scrollTop = 0;
      break;
    case "End":
      el.scrollTop = el.scrollHeight;
      break;
    default:
      return;
  }
  e.preventDefault();
}

/**
 * Floating overlay scrollbar (in the spirit of superlogical.com): a slim
 * fixed track on the right edge with a gradient pill thumb that mirrors the
 * page scroll position. The native scrollbar is hidden in CSS; this component
 * is the only scroll indicator.
 *
 * Position updates are written straight to the DOM inside rAF (no React state
 * per scroll event). The thumb supports drag-to-scroll with pointer capture
 * and click-to-jump on the track.
 */
export default function Scrollbar() {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const track = trackRef.current;
    const thumb = thumbRef.current;
    if (!track || !thumb) return;

    let raf = 0;
    let dragging = false;
    let dragStartY = 0;
    let dragStartScroll = 0;

    const update = () => {
      raf = 0;
      const el = document.documentElement;
      const scrollable = el.scrollHeight - el.clientHeight;
      const trackHeight = track.clientHeight;
      if (scrollable <= 0 || trackHeight <= 0) {
        track.style.visibility = "hidden";
        return;
      }
      track.style.visibility = "visible";
      const thumbHeight = Math.max(
        MIN_THUMB_PX,
        (el.clientHeight / el.scrollHeight) * trackHeight,
      );
      const maxY = trackHeight - thumbHeight;
      const y = maxY * (el.scrollTop / scrollable);
      thumb.style.height = `${thumbHeight}px`;
      thumb.style.transform = `translateY(${y}px)`;
      track.setAttribute(
        "aria-valuenow",
        String(Math.round((el.scrollTop / scrollable) * 100)),
      );
    };

    const schedule = () => {
      if (raf === 0) raf = requestAnimationFrame(update);
    };

    const onScroll = () => {
      if (!dragging) schedule();
    };

    const scrollablePixels = () =>
      document.documentElement.scrollHeight -
      document.documentElement.clientHeight;

    const onThumbPointerDown = (e: PointerEvent) => {
      if (scrollablePixels() <= 0) return;
      dragging = true;
      dragStartY = e.clientY;
      dragStartScroll = document.documentElement.scrollTop;
      thumb.setPointerCapture(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
    };

    const onThumbPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const trackHeight = track.clientHeight;
      const thumbHeight = thumb.clientHeight || MIN_THUMB_PX;
      const maxY = Math.max(1, trackHeight - thumbHeight);
      const deltaRatio = (e.clientY - dragStartY) / maxY;
      document.documentElement.scrollTop =
        dragStartScroll + deltaRatio * scrollablePixels();
    };

    const endDrag = () => {
      dragging = false;
    };

    const onTrackPointerDown = (e: PointerEvent) => {
      if (e.target !== track || scrollablePixels() <= 0) return;
      const rect = track.getBoundingClientRect();
      const ratio = (e.clientY - rect.top) / rect.height;
      document.documentElement.scrollTop = ratio * scrollablePixels();
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", schedule);
    thumb.addEventListener("pointerdown", onThumbPointerDown);
    thumb.addEventListener("pointermove", onThumbPointerMove);
    thumb.addEventListener("pointerup", endDrag);
    thumb.addEventListener("pointercancel", endDrag);
    track.addEventListener("pointerdown", onTrackPointerDown);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(schedule);
      resizeObserver.observe(document.documentElement);
      if (document.body) resizeObserver.observe(document.body);
    }

    return () => {
      if (raf !== 0) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", schedule);
      thumb.removeEventListener("pointerdown", onThumbPointerDown);
      thumb.removeEventListener("pointermove", onThumbPointerMove);
      thumb.removeEventListener("pointerup", endDrag);
      thumb.removeEventListener("pointercancel", endDrag);
      track.removeEventListener("pointerdown", onTrackPointerDown);
      resizeObserver?.disconnect();
    };
  }, []);

  return (
    <div
      ref={trackRef}
      role="scrollbar"
      aria-label="Przewijanie strony"
      aria-controls="page-content"
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={0}
      tabIndex={0}
      onKeyDown={handleTrackKeyDown}
      className="fixed top-3 bottom-3 right-3 z-40 hidden w-2 touch-none select-none rounded-full bg-amber-950/10 [@media(pointer:fine)]:block"
    >
      <div
        ref={thumbRef}
        className="w-full cursor-pointer rounded-full bg-gradient-to-b from-yellow-300 via-orange-500 to-rose-500 opacity-80 shadow-sm transition-opacity duration-200 hover:opacity-100"
      />
    </div>
  );
}
