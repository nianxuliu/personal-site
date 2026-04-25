"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { NavLink } from "@/components/layout/nav-link";
import { Container } from "@/components/ui/container";
import { navItems } from "@/content/navigation";

type IndicatorRect = {
  centerX: number;
  width: number;
};

export function SiteHeader() {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement | null>(null);
  const [indicator, setIndicator] = useState<IndicatorRect | null>(null);

  useLayoutEffect(() => {
    const updateIndicator = () => {
      const nav = navRef.current;
      if (!nav) return;

      const active = nav.querySelector<HTMLAnchorElement>('a[data-nav-item][data-active="true"]');
      if (!active) {
        setIndicator(null);
        return;
      }

      setIndicator({
        centerX: active.offsetLeft + active.offsetWidth / 2,
        width: Math.max(26, Math.min(48, active.offsetWidth - 20)),
      });
    };

    updateIndicator();
    window.addEventListener("resize", updateIndicator);
    return () => {
      window.removeEventListener("resize", updateIndicator);
    };
  }, [pathname]);

  return (
    <header className="relative z-30">
      <Container className="flex items-center justify-start py-4">
        <nav
          ref={navRef}
          className="glass-panel relative inline-flex items-center gap-1 overflow-hidden rounded-xl border border-zinc-200/90 px-1 py-1"
        >
          {indicator ? (
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-[2px] left-0 h-[2px] rounded-full bg-zinc-900 transition-[transform,width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{
                transform: `translateX(${indicator.centerX}px) translateX(-50%)`,
                width: `${indicator.width}px`,
              }}
            />
          ) : null}
          {navItems.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </nav>
      </Container>
    </header>
  );
}
