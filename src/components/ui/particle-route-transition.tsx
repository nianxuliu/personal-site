"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type Particle = {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  alpha: number;
  size: number;
};

type ParticleNavigate = (href: string) => void;

declare global {
  interface Window {
    __particleNavigate?: ParticleNavigate;
  }
}

const OUT_DURATION = 260;
const IN_DURATION = 310;
const MID_GAP = 0;
const POST_NAV_WAIT = 38;
const STEP = 6;
const MAX_PARTICLES = 10000;

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
}

function clampRectTo(container: DOMRect, rect: DOMRect) {
  const left = Math.max(container.left, rect.left);
  const top = Math.max(container.top, rect.top);
  const right = Math.min(container.right, rect.right);
  const bottom = Math.min(container.bottom, rect.bottom);
  if (right <= left || bottom <= top) return null;
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function collectTextRects(main: HTMLElement) {
  const rects: Array<{ left: number; top: number; right: number; bottom: number; width: number; height: number }> = [];
  const container = main.getBoundingClientRect();
  const viewportLeft = 0;
  const viewportTop = 0;
  const viewportRight = window.innerWidth;
  const viewportBottom = window.innerHeight;

  const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.textContent || !node.textContent.trim()) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let node = walker.nextNode();
  while (node) {
    const range = document.createRange();
    range.selectNodeContents(node);
    const clientRects = range.getClientRects();
    for (const r of clientRects) {
      const clipped = clampRectTo(container, r);
      if (!clipped) continue;

      const left = Math.max(viewportLeft, clipped.left);
      const top = Math.max(viewportTop, clipped.top);
      const right = Math.min(viewportRight, clipped.right);
      const bottom = Math.min(viewportBottom, clipped.bottom);
      const width = right - left;
      const height = bottom - top;
      if (width >= 2 && height >= 2) {
        rects.push({ left, top, right, bottom, width, height });
      }
    }
    node = walker.nextNode();
  }

  return { container, rects };
}

function createParticlesFromRects(
  container: DOMRect,
  rects: Array<{ left: number; top: number; right: number; bottom: number; width: number; height: number }>,
  mode: "out" | "in",
) {
  const particles: Particle[] = [];
  const cx = container.width / 2;
  const cy = container.height / 2;
  const estimated = rects.reduce(
    (count, rect) => count + Math.ceil(rect.width / STEP) * Math.ceil(rect.height / STEP),
    0,
  );
  const sampleRate = estimated > MAX_PARTICLES ? MAX_PARTICLES / estimated : 1;

  for (const rect of rects) {
    for (let y = rect.top; y < rect.bottom; y += STEP) {
      for (let x = rect.left; x < rect.right; x += STEP) {
        if (sampleRate < 1 && Math.random() > sampleRate) continue;
        const localX = x - container.left;
        const localY = y - container.top;
        const dx = localX - cx;
        const dy = localY - cy;
        const norm = Math.hypot(dx, dy) || 1;
        const spread = 30 + Math.random() * 125;
        const sx = localX + (dx / norm) * spread + (Math.random() - 0.5) * 28;
        const sy = localY + (dy / norm) * spread + (Math.random() - 0.5) * 28;

        particles.push(
          mode === "out"
            ? {
                fromX: localX,
                fromY: localY,
                toX: sx,
                toY: sy,
                alpha: 0.95,
                size: 1.7,
              }
            : {
                fromX: sx,
                fromY: sy,
                toX: localX,
                toY: localY,
                alpha: 0.95,
                size: 1.7,
              },
        );
      }
    }
  }

  if (particles.length > MAX_PARTICLES) {
    particles.length = MAX_PARTICLES;
  }
  return particles;
}

function createFallbackParticles(width: number, height: number, mode: "out" | "in") {
  const particles: Particle[] = [];
  const count = 4200;
  const cx = width / 2;
  const cy = height / 2;

  for (let i = 0; i < count; i += 1) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const dx = x - cx;
    const dy = y - cy;
    const norm = Math.hypot(dx, dy) || 1;
    const spread = 36 + Math.random() * 130;
    const sx = x + (dx / norm) * spread + (Math.random() - 0.5) * 42;
    const sy = y + (dy / norm) * spread + (Math.random() - 0.5) * 42;

    particles.push(
      mode === "out"
        ? { fromX: x, fromY: y, toX: sx, toY: sy, alpha: 0.9, size: 1.8 }
        : { fromX: sx, fromY: sy, toX: x, toY: y, alpha: 0.9, size: 1.8 },
    );
  }

  return particles;
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  particles: Particle[],
  progress: number,
  mode: "out" | "in",
) {
  const eased = mode === "out" ? easeOutCubic(progress) : easeInOutCubic(progress);

  ctx.clearRect(0, 0, width, height);

  for (const particle of particles) {
    const x = particle.fromX + (particle.toX - particle.fromX) * eased;
    const y = particle.fromY + (particle.toY - particle.fromY) * eased;
    const alpha =
      mode === "out"
        ? // Fade in slightly first, then fully dissolve to zero.
          particle.alpha * Math.min(1, progress * 2.4) * (1 - eased)
        : // Smoothly appear, then fade while converging.
          particle.alpha * Math.min(1, progress * 2.2) * (1 - eased);
    ctx.fillStyle = `rgba(0,0,0,${Math.max(0, Math.min(1, alpha))})`;
    ctx.fillRect(x, y, particle.size, particle.size);
  }
}

function animateParticles(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  particles: Particle[],
  duration: number,
  mode: "out" | "in",
  onProgress?: (progress: number) => void,
) {
  return new Promise<void>((resolve) => {
    const start = performance.now();

    const run = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      onProgress?.(t);
      drawFrame(ctx, width, height, particles, t, mode);
      if (t < 1) requestAnimationFrame(run);
      else resolve();
    };

    requestAnimationFrame(run);
  });
}

function getInternalHref(rawHref: string) {
  const parsed = new URL(rawHref, window.location.href);
  if (parsed.origin !== window.location.origin) return null;
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

function getInternalPathAndSearch(rawHref: string) {
  const parsed = new URL(rawHref, window.location.href);
  if (parsed.origin !== window.location.origin) return null;
  return `${parsed.pathname}${parsed.search}`;
}

function getMainFingerprint(main: HTMLElement) {
  const text = main.innerText.replace(/\s+/g, " ").trim();
  return `${text.length}:${text.slice(0, 240)}`;
}

async function waitForRouteSettle(main: HTMLElement, href: string, timeoutMs = 760) {
  const targetPath = getInternalPathAndSearch(href);
  let mutated = false;
  const observer = new MutationObserver(() => {
    mutated = true;
  });

  observer.observe(main, {
    subtree: true,
    childList: true,
    characterData: true,
  });

  const start = performance.now();
  try {
    while (performance.now() - start < timeoutMs) {
      const currentPath = `${window.location.pathname}${window.location.search}`;
      const pathMatched = targetPath ? currentPath === targetPath : true;
      if (pathMatched && mutated) return true;
      await wait(16);
    }
    return false;
  } finally {
    observer.disconnect();
  }
}

function isIgnoredAnchor(anchor: HTMLAnchorElement) {
  if (anchor.target && anchor.target !== "_self") return true;
  if (anchor.hasAttribute("download")) return true;

  const rawHref = anchor.getAttribute("href");
  if (!rawHref) return true;

  if (
    rawHref.startsWith("#") ||
    rawHref.startsWith("mailto:") ||
    rawHref.startsWith("tel:") ||
    rawHref.startsWith("javascript:")
  ) {
    return true;
  }

  const internal = getInternalHref(rawHref);
  return internal === null;
}

export function ParticleRouteTransition() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runningRef = useRef(false);

  const playTransition = useCallback(
    async (href: string) => {
      if (runningRef.current) {
        router.push(href);
        return;
      }

      const main = document.getElementById("page-main");
      const canvas = canvasRef.current;
      if (!main || !canvas) {
        router.push(href);
        return;
      }

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        router.push(href);
        return;
      }

      runningRef.current = true;
      const prevOpacity = main.style.opacity;
      const prevPointer = main.style.pointerEvents;
      const prevTransition = main.style.transition;
      const prevCanvasDisplay = canvas.style.display;

      try {
        const before = collectTextRects(main);
        const beforeFingerprint = getMainFingerprint(main);
        const width = Math.max(1, Math.ceil(before.container.width));
        const height = Math.max(1, Math.ceil(before.container.height));

        canvas.width = width;
        canvas.height = height;
        canvas.style.position = "fixed";
        canvas.style.left = `${before.container.left}px`;
        canvas.style.top = `${before.container.top}px`;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        canvas.style.pointerEvents = "none";
        canvas.style.zIndex = "40";
        canvas.style.background = "transparent";
        canvas.style.display = "block";

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          router.push(href);
          return;
        }

        const outParticles =
          before.rects.length > 0
            ? createParticlesFromRects(before.container, before.rects, "out")
            : createFallbackParticles(width, height, "out");

        main.style.transition = "opacity 170ms cubic-bezier(0.22, 0.61, 0.36, 1)";
        main.style.opacity = "1";
        main.style.pointerEvents = "none";
        requestAnimationFrame(() => {
          main.style.opacity = "0";
        });
        await animateParticles(ctx, width, height, outParticles, OUT_DURATION, "out");
        await wait(MID_GAP);

        const settlePromise = waitForRouteSettle(main, href);
        router.push(href);
        await wait(POST_NAV_WAIT);
        const routeSettled = await settlePromise;
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

        const after = collectTextRects(main);
        const afterFingerprint = getMainFingerprint(main);
        const canUseAfterRects =
          routeSettled && after.rects.length > 0 && afterFingerprint !== beforeFingerprint;

        const inParticles = canUseAfterRects
          ? createParticlesFromRects(after.container, after.rects, "in")
          : createFallbackParticles(width, height, "in");

        const revealThreshold = canUseAfterRects ? 0.48 : 0.8;
        if (!canUseAfterRects) {
          await wait(42);
        }

        let hasRevealed = false;
        main.style.opacity = "0";
        main.style.transition = "opacity 190ms cubic-bezier(0.22, 0.61, 0.36, 1)";
        await animateParticles(ctx, width, height, inParticles, IN_DURATION, "in", (t) => {
          if (!hasRevealed && t >= revealThreshold) {
            hasRevealed = true;
            main.style.opacity = "1";
          }
        });
        main.style.opacity = "1";
      } catch {
        router.push(href);
      } finally {
        main.style.opacity = prevOpacity;
        main.style.pointerEvents = prevPointer;
        main.style.transition = prevTransition;
        canvas.style.display = prevCanvasDisplay || "none";
        runningRef.current = false;
      }
    },
    [router],
  );

  useEffect(() => {
    window.__particleNavigate = (href: string) => {
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (href === current) return;
      void playTransition(href);
    };

    const onDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (isIgnoredAnchor(anchor)) return;

      const nextHref = getInternalHref(anchor.href);
      if (!nextHref) return;

      event.preventDefault();
      void playTransition(nextHref);
    };

    document.addEventListener("click", onDocumentClick, true);
    return () => {
      document.removeEventListener("click", onDocumentClick, true);
      delete window.__particleNavigate;
    };
  }, [playTransition]);

  return <canvas ref={canvasRef} style={{ display: "none" }} aria-hidden />;
}
