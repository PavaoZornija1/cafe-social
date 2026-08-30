"use client";

import { useInView } from "motion/react";
import { useRef, type ComponentPropsWithoutRef, type ElementType, type ReactNode } from "react";
import { useMotionSafe } from "@/lib/motion";

type GlowCardProps<T extends ElementType = "div"> = {
  as?: T;
  children: ReactNode;
  className?: string;
  variant?: "default" | "dark" | "honey";
  effect?: "border" | "glance";
  scrollGlance?: boolean;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className" | "variant" | "effect" | "scrollGlance">;

const variantClass = {
  default: "",
  dark: "landing-card-dark",
  honey: "landing-card-honey",
};

const effectClass = {
  border: "landing-card",
  glance: "landing-card-glance",
};

export function GlowCard<T extends ElementType = "div">({
  as,
  children,
  className = "",
  variant = "default",
  effect = "border",
  scrollGlance = false,
  ...props
}: GlowCardProps<T>) {
  const Tag = as ?? "div";
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.5, margin: "-60px" });
  const { reduced } = useMotionSafe();
  const inViewClass = scrollGlance && isInView && !reduced ? "is-in-view" : "";

  return (
    <Tag
      {...(scrollGlance ? { ref: ref as never } : {})}
      className={`${effectClass[effect]} ${variantClass[variant]} ${scrollGlance ? "landing-card-scroll-glance" : ""} ${inViewClass} shadow-landing-card ${className}`}
      {...props}
    >
      {children}
    </Tag>
  );
}
