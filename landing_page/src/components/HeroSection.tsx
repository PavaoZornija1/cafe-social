"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { useTranslations } from "next-intl";
import { AnimatedBackground } from "./AnimatedBackground";
import { LandingButton } from "./LandingButton";
import { PhoneMock } from "./PhoneMock";
import { useMotionSafe } from "@/lib/motion";

export function HeroSection() {
  const t = useTranslations("hero");
  const { reduced, spring } = useMotionSafe();
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const phoneY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, 40]);
  const opacity = useTransform(scrollYProgress, [0, 0.7], [1, 0.35]);

  const item = (delay: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 28 },
          animate: { opacity: 1, y: 0 },
          transition: { ...spring, delay },
        };

  return (
    <section
      ref={sectionRef}
      className="relative min-h-[92vh] overflow-hidden px-4 pb-20 pt-28 sm:px-6 lg:px-8 lg:pb-28 lg:pt-36"
    >
      <AnimatedBackground variant="hero" />

      <motion.div style={reduced ? undefined : { opacity }} className="relative z-10 mx-auto max-w-6xl">
        <div className="grid items-center gap-14 lg:grid-cols-[1.08fr_0.92fr] lg:gap-10">
          <motion.div style={reduced ? undefined : { y: contentY }}>
            <motion.p className="landing-eyebrow" {...item(0)}>
              {t("eyebrow")}
            </motion.p>
            <motion.h1
              className="mt-5 max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl lg:leading-[1.05]"
              {...item(0.08)}
            >
              <span className="landing-text-gradient">{t("title")}</span>
            </motion.h1>
            <motion.p
              className="mt-6 max-w-xl text-lg leading-relaxed text-text-secondary sm:text-xl"
              {...item(0.16)}
            >
              {t("subtitle")}
            </motion.p>
            <motion.div className="mt-9 flex flex-wrap gap-3" {...item(0.24)}>
              <LandingButton href="#download" variant="primary">
                {t("ctaApp")}
              </LandingButton>
              <LandingButton href="/partners" variant="secondary">
                {t("ctaPartners")}
              </LandingButton>
            </motion.div>
            <motion.a
              href="#how-it-works"
              className="landing-scroll-cue mt-12 inline-flex items-center gap-2 text-sm font-semibold text-text-muted"
              {...item(0.32)}
            >
              {t("scroll")}
              <motion.span
                aria-hidden="true"
                animate={reduced ? undefined : { y: [0, 5, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              >
                ↓
              </motion.span>
            </motion.a>
          </motion.div>

          <motion.div
            className="relative mx-auto w-full max-w-[360px] lg:max-w-none"
            style={reduced ? undefined : { y: phoneY }}
          >
            <HeroFloatingChip
              label={t("phoneXp")}
              className="-left-2 top-8 hidden sm:block"
              delay={0.5}
              reduced={reduced}
            />
            <HeroFloatingChip
              label={t("phoneVenue")}
              className="-right-1 bottom-16 hidden sm:block"
              delay={0.9}
              reduced={reduced}
            />
            <PhoneMock />
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}

function HeroFloatingChip({
  label,
  className,
  delay,
  reduced,
}: {
  label: string;
  className: string;
  delay: number;
  reduced: boolean;
}) {
  return (
    <motion.div
      className={`absolute z-20 max-w-[160px] rounded-2xl border border-border/80 bg-surface/90 px-3 py-2 text-xs font-semibold text-foreground shadow-landing-card backdrop-blur-md ${className}`}
      initial={reduced ? false : { opacity: 0, scale: 0.9, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 22, delay }}
    >
      <motion.span
        animate={reduced ? undefined : { y: [0, -4, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay }}
        className="block"
      >
        {label}
      </motion.span>
    </motion.div>
  );
}
