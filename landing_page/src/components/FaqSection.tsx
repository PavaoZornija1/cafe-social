"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useMotionSafe } from "@/lib/motion";
import { Reveal } from "./Reveal";
import { SectionHeader, SectionShell } from "./SectionHeader";
import { GlowCard } from "./GlowCard";

const faqKeys = ["what", "free", "unlock", "partner", "subscription", "stores"] as const;

const answerReveal = {
  duration: 0.65,
  ease: [0.22, 1, 0.36, 1] as const,
};

function FaqAnswer({ children, isOpen }: { children: ReactNode; isOpen: boolean }) {
  const { reduced } = useMotionSafe();

  if (reduced) {
    return isOpen ? (
      <div className="px-5 pb-5 text-sm leading-relaxed text-text-secondary">{children}</div>
    ) : null;
  }

  return (
    <AnimatePresence initial={false}>
      {isOpen ? (
        <motion.div
          key="answer"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={answerReveal}
          className="overflow-hidden"
        >
          <motion.div
            initial={{ y: -8 }}
            animate={{ y: 0 }}
            exit={{ y: -8 }}
            transition={answerReveal}
            className="px-5 pb-5 text-sm leading-relaxed text-text-secondary"
          >
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function FaqSection() {
  const t = useTranslations("faq");
  const [openKey, setOpenKey] = useState<string | null>("what");

  return (
    <SectionShell id="faq" background="cream">
      <SectionHeader eyebrow={t("eyebrow")} title={t("title")} align="center" />

      <div className="mx-auto mt-12 max-w-3xl space-y-3">
        {faqKeys.map((key, index) => {
          const isOpen = openKey === key;
          return (
            <Reveal key={key} delay={index * 0.04}>
              <GlowCard className="overflow-hidden rounded-3xl border border-border bg-surface">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left"
                  aria-expanded={isOpen}
                  onClick={() => setOpenKey(isOpen ? null : key)}
                >
                  <span className="text-base font-semibold text-foreground">
                    {t(`items.${key}.q`)}
                  </span>
                  <span className="text-xl text-primary" aria-hidden="true">
                    {isOpen ? "−" : "+"}
                  </span>
                </button>
                <FaqAnswer isOpen={isOpen}>{t(`items.${key}.a`)}</FaqAnswer>
              </GlowCard>
            </Reveal>
          );
        })}
      </div>
    </SectionShell>
  );
}
