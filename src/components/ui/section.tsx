"use client";

import type { HTMLAttributes, ReactNode } from "react";

import { SharedHeading } from "@/components/ui/shared-heading";
import { cn } from "@/lib/utils";

type SectionProps = HTMLAttributes<HTMLElement> & {
  title?: string;
  description?: string;
  actions?: ReactNode;
  headingLevel?: 1 | 2;
  eyebrow?: string;
};

export function Section({
  title,
  description,
  actions,
  headingLevel = 2,
  eyebrow,
  className,
  children,
  ...props
}: SectionProps) {
  return (
    <section className={cn("space-y-6", className)} {...props}>
      {(title || description || actions || eyebrow) && (
        <SharedHeading
          title={title}
          description={description}
          eyebrow={eyebrow}
          actions={actions}
          headingLevel={headingLevel}
        />
      )}
      {children}
    </section>
  );
}




