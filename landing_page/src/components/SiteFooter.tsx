import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { navAnchors } from "@/lib/config";
import { AnimatedBackground } from "./AnimatedBackground";
import { HomeSectionLink } from "./HomeSectionLink";
import { LanguageSwitcher } from "./LanguageSwitcher";

export async function SiteFooter() {
  const t = await getTranslations("footer");
  const tNav = await getTranslations("nav");
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden border-t border-border px-4 py-16 sm:px-6 lg:px-8">
      <AnimatedBackground variant="surface" />
      <div className="relative z-10 mx-auto grid max-w-6xl gap-10 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <Image src="/brand/icon.png" alt="Cafe Social" width={44} height={44} className="rounded-xl" />
            <span className="text-lg font-bold">Cafe Social</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-text-secondary">
            {t("tagline")}
          </p>
          <div className="mt-6">
            <LanguageSwitcher />
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-text-muted">
            {t("navTitle")}
          </p>
          <ul className="mt-4 space-y-3">
            {navAnchors.map((item) => (
              <li key={item.key}>
                <HomeSectionLink href={item.href} className="landing-nav-link">
                  {tNav(item.key)}
                </HomeSectionLink>
              </li>
            ))}
            <li>
              <Link href="/partners" className="landing-nav-link">
                {t("partners")}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-text-muted">
            {t("legalTitle")}
          </p>
          <ul className="mt-4 space-y-3">
            <li>
              <Link href="/privacy" className="landing-nav-link">
                {t("privacy")}
              </Link>
            </li>
            <li>
              <Link href="/terms" className="landing-nav-link">
                {t("terms")}
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <p className="relative z-10 mx-auto mt-12 max-w-6xl text-sm text-text-muted">
        {t("copyright", { year })}
      </p>
    </footer>
  );
}
