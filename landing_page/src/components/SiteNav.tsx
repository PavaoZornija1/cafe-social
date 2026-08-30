"use client";

import { motion, useScroll, useMotionValueEvent } from "motion/react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useState } from "react";
import { navAnchors } from "@/lib/config";
import { HomeSectionLink } from "./HomeSectionLink";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { LandingButton } from "./LandingButton";

export function SiteNav() {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 24);
  });

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed inset-x-0 top-0 z-50 transition-[background,box-shadow,border-color] duration-300 ${
        scrolled
          ? "border-b border-border/70 bg-background/88 shadow-landing-nav backdrop-blur-xl"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex items-center gap-3">
          <motion.div whileHover={{ rotate: [-2, 2, 0] }} transition={{ duration: 0.4 }}>
            <Image
              src="/brand/icon.png"
              alt="Cafe Social"
              width={40}
              height={40}
              className="rounded-xl transition group-hover:shadow-landing-card"
              priority
            />
          </motion.div>
          <span className="hidden text-lg font-bold tracking-tight sm:inline">Cafe Social</span>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex">
          {navAnchors.map((item) => (
            <HomeSectionLink key={item.key} href={item.href} className="landing-nav-link">
              {t(item.key)}
            </HomeSectionLink>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <LanguageSwitcher compact />
          <LandingButton href="#download" variant="primary" className="!px-4 !py-2">
            {t("getApp")}
          </LandingButton>
        </div>

        <button
          type="button"
          className="inline-flex rounded-full border border-border bg-surface px-3 py-2 text-sm font-semibold lg:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          {open ? t("close") : t("menu")}
        </button>
      </div>

      {open ? (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-t border-border bg-background/95 px-4 py-4 backdrop-blur-xl lg:hidden"
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-4">
            {navAnchors.map((item) => (
              <HomeSectionLink
                key={item.key}
                href={item.href}
                className="text-base font-medium text-foreground"
                onClick={() => setOpen(false)}
              >
                {t(item.key)}
              </HomeSectionLink>
            ))}
            <LanguageSwitcher />
            <LandingButton href="#download" variant="primary" className="w-full justify-center">
              {t("getApp")}
            </LandingButton>
          </div>
        </motion.div>
      ) : null}
    </motion.header>
  );
}
