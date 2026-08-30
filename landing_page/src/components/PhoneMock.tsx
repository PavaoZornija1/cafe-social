"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useMotionSafe } from "@/lib/motion";

export function PhoneMock() {
  const t = useTranslations("hero");
  const { reduced } = useMotionSafe();

  return (
    <motion.div
      className="relative mx-auto w-full max-w-[320px]"
      animate={reduced ? undefined : { y: [0, -12, 0] }}
      transition={
        reduced ? undefined : { duration: 5.5, repeat: Infinity, ease: "easeInOut" }
      }
    >
      <motion.div
        className="absolute -inset-8 rounded-[2.75rem] bg-primary/15 blur-3xl"
        animate={reduced ? undefined : { scale: [1, 1.08, 1], opacity: [0.5, 0.85, 0.5] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="relative overflow-hidden rounded-[2rem] border border-border/80 bg-surface p-3 shadow-landing-card">
        <div className="rounded-[1.4rem] bg-gradient-to-b from-primary-muted to-surface-muted p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Cafe Social
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">{t("phoneVenue")}</p>
            </div>
            <motion.span
              className="rounded-full bg-honey-muted px-2 py-1 text-[11px] font-bold text-honey"
              animate={reduced ? undefined : { scale: [1, 1.06, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              {t("phoneXp")}
            </motion.span>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Play
              </p>
              <p className="mt-2 text-lg font-bold text-foreground">{t("phoneGameWord")}</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-primary-muted">
                <motion.div
                  className="h-2 rounded-full bg-gradient-to-r from-primary to-primary-dark"
                  initial={{ width: "25%" }}
                  animate={reduced ? undefined : { width: ["25%", "78%", "25%"] }}
                  transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Arena
              </p>
              <p className="mt-2 text-lg font-bold text-foreground">{t("phoneGameBrawler")}</p>
              <div className="mt-3 flex gap-2">
                <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">
                  Queue
                </span>
                <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-text-secondary">
                  Practice
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
