import { cn } from "@/lib/utils";

export type LinkButtonVariant = "outline" | "solid";

type LinkButtonClassOptions = {
  variant?: LinkButtonVariant;
  className?: string;
};

const BASE_BUTTON_CLASS =
  "glass-button inline-flex items-center justify-center rounded-xl border px-4 py-2 text-[15px] font-medium tracking-tight transition-[color,background-color,border-color,box-shadow,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-[1px] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20";

const VARIANT_CLASS: Record<LinkButtonVariant, string> = {
  outline: "text-zinc-700",
  solid: "glass-button-solid text-white",
};

export function linkButtonClass({ variant = "outline", className }: LinkButtonClassOptions = {}) {
  return cn(BASE_BUTTON_CLASS, VARIANT_CLASS[variant], className);
}
