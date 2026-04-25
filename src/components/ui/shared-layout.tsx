import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type SharedLayoutProps = {
  layoutId: string;
  className?: string;
  children: ReactNode;
};

export function SharedLayout({ layoutId, className, children }: SharedLayoutProps) {
  void layoutId;
  return <div className={cn(className)}>{children}</div>;
}
