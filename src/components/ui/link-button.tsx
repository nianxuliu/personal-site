"use client";

import Link, { type LinkProps } from "next/link";
import type { ComponentPropsWithoutRef, MouseEvent, ReactNode } from "react";

import { linkButtonClass, type LinkButtonVariant } from "@/components/ui/link-button-class";

type LinkButtonProps = {
  href: LinkProps["href"];
  children: ReactNode;
  className?: string;
  variant?: LinkButtonVariant;
} & Omit<ComponentPropsWithoutRef<"a">, "href" | "className">;

export function LinkButton({
  href,
  children,
  className,
  variant = "outline",
  onClick,
  ...props
}: LinkButtonProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (event.button !== 0) return;
    if (typeof href !== "string") return;
    if (!href.startsWith("/")) return;

    const particleNavigate = window.__particleNavigate;
    if (!particleNavigate) return;

    event.preventDefault();
    particleNavigate(href);
  };

  return (
    <Link href={href} className={linkButtonClass({ variant, className })} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}
