"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent } from "react";

import { cn } from "@/lib/utils";

type NavLinkProps = {
  href: string;
  label: string;
};

export function NavLink({ href, label }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = href === "/" ? pathname === href : pathname.startsWith(href);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (event.button !== 0) return;

    const particleNavigate = window.__particleNavigate;
    if (!particleNavigate) return;

    event.preventDefault();
    particleNavigate(href);
  };

  return (
    <Link
      href={href}
      data-nav-item
      data-active={isActive ? "true" : "false"}
      onClick={handleClick}
      className={cn(
        "relative z-10 inline-flex h-10 min-w-[84px] items-center justify-center whitespace-nowrap rounded-xl px-4 text-[15px] font-medium transition-[color,background-color,box-shadow,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        isActive
          ? "text-zinc-900"
          : "text-zinc-600",
        "hover:-translate-y-[1px] hover:bg-zinc-900 hover:text-white hover:shadow-[0_10px_20px_rgba(15,23,42,0.24)]",
      )}
    >
      {label}
    </Link>
  );
}
