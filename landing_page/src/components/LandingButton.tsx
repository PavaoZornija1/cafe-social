"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { useMotionSafe } from "@/lib/motion";

type LandingButtonProps = {
  children: ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "ghost";
  href: string;
  external?: boolean;
};

export function LandingButton({
  children,
  className = "",
  variant = "primary",
  href,
  external = false,
}: LandingButtonProps) {
  const { reduced } = useMotionSafe();
  const pathname = usePathname();
  const variantClass =
    variant === "primary"
      ? "landing-btn-primary"
      : variant === "secondary"
        ? "landing-btn-secondary"
        : "landing-btn-ghost";

  const motionProps = reduced
    ? {}
    : {
        whileHover: { scale: 1.04, y: -2 },
        whileTap: { scale: 0.98 },
        transition: { type: "spring" as const, stiffness: 420, damping: 24 },
      };

  const classes = `${variantClass} ${className}`;

  const isSectionHash = href.startsWith("#") || href.startsWith("/#");
  const hash = href.startsWith("/#") ? href.slice(1) : href;
  const onHome = pathname === "/";

  if (external || href.startsWith("mailto:")) {
    return (
      <motion.a href={href} className={classes} {...motionProps}>
        {children}
      </motion.a>
    );
  }

  if (isSectionHash) {
    if (onHome) {
      return (
        <motion.a href={hash} className={classes} {...motionProps}>
          {children}
        </motion.a>
      );
    }

    return (
      <motion.div {...motionProps} className="inline-flex">
        <Link href={`/${hash}`} className={classes}>
          {children}
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div {...motionProps} className="inline-flex">
      <Link href={href} className={classes}>
        {children}
      </Link>
    </motion.div>
  );
}
