"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type SharedHeadingProps = {
  title?: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  headingLevel?: 1 | 2;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
};

export function SharedHeading({
  title,
  description,
  eyebrow,
  actions,
  headingLevel = 2,
  className,
  titleClassName,
  descriptionClassName,
}: SharedHeadingProps) {
  if (!title && !description && !eyebrow && !actions) {
    return null;
  }

  const headingTextClass = cn(
    "font-semibold tracking-tight text-zinc-900",
    headingLevel === 1 ? "text-4xl md:text-5xl" : "text-3xl",
    titleClassName,
  );

  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="space-y-2">
        {eyebrow && (
          <span className="glass-chip inline-flex w-fit items-center rounded-lg border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-600">
            {eyebrow}
          </span>
        )}

        {title && (
          <>
            {headingLevel === 1 ? (
              <h1 className={headingTextClass}>{title}</h1>
            ) : (
              <h2 className={headingTextClass}>{title}</h2>
            )}
          </>
        )}

        {description && (
          <p className={cn("max-w-3xl text-base leading-8 text-zinc-600", descriptionClassName)}>
            {description}
          </p>
        )}
      </div>

      {actions}
    </header>
  );
}
