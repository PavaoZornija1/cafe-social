import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { siteConfig } from "@/lib/config";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { GlowCard } from "@/components/GlowCard";
import { Reveal } from "@/components/Reveal";

const whatKeys = [
  "context",
  "games",
  "challenges",
  "perks",
  "social",
  "analytics",
] as const;

const guestKeys = ["fun", "belonging", "rewards"] as const;
const venueKeys = ["repeat", "brand", "measure", "differentiate"] as const;
const pilotKeys = ["interest", "offer", "launch", "review"] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("partnersPage");

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function PartnersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("partnersPage");

  return (
    <>
      <SiteNav />
      <main className="px-4 pb-20 pt-28 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              Cafe Social
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
              {t("heroTitle")}
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-text-secondary">
              {t("heroSubtitle")}
            </p>
          </Reveal>

          <Reveal className="mt-12">
            <GlowCard className="rounded-3xl border border-border bg-surface p-6">
              <h2 className="text-2xl font-bold">{t("whatTitle")}</h2>
              <ul className="mt-4 space-y-3 text-text-secondary">
                {whatKeys.map((key) => (
                  <li key={key} className="flex gap-3">
                    <span className="mt-1 text-primary">•</span>
                    <span>{t(`whatItems.${key}`)}</span>
                  </li>
                ))}
              </ul>
            </GlowCard>
          </Reveal>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <Reveal>
              <GlowCard className="h-full rounded-3xl border border-border bg-surface p-6">
                <h2 className="text-xl font-bold">{t("benefitsGuestTitle")}</h2>
                <ul className="mt-4 space-y-3 text-sm text-text-secondary">
                  {guestKeys.map((key) => (
                    <li key={key}>{t(`benefitsGuest.${key}`)}</li>
                  ))}
                </ul>
              </GlowCard>
            </Reveal>
            <Reveal delay={0.08}>
              <GlowCard className="h-full rounded-3xl border border-border bg-surface p-6">
                <h2 className="text-xl font-bold">{t("benefitsVenueTitle")}</h2>
                <ul className="mt-4 space-y-3 text-sm text-text-secondary">
                  {venueKeys.map((key) => (
                    <li key={key}>{t(`benefitsVenue.${key}`)}</li>
                  ))}
                </ul>
              </GlowCard>
            </Reveal>
          </div>

          <Reveal className="mt-8">
            <GlowCard
              variant="dark"
              className="rounded-3xl border border-border bg-primary-dark p-6 text-white"
            >
              <h2 className="text-2xl font-bold">{t("pilotTitle")}</h2>
              <ol className="mt-4 space-y-3">
                {pilotKeys.map((key, index) => (
                  <li key={key} className="flex gap-3 text-white/90">
                    <span className="font-bold text-white">{index + 1}.</span>
                    <span>{t(`pilotSteps.${key}`)}</span>
                  </li>
                ))}
              </ol>
            </GlowCard>
          </Reveal>

          <Reveal className="mt-8">
            <GlowCard className="rounded-3xl border border-border bg-surface-muted p-6 text-center">
              <h2 className="text-2xl font-bold">{t("contactTitle")}</h2>
              <p className="mt-3 text-text-secondary">{t("contactBody")}</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <a
                  href={`mailto:${siteConfig.contactEmail}`}
                  className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white"
                >
                  {t("contactCta")}
                </a>
                <Link
                  href="/"
                  className="rounded-full border border-border bg-surface px-6 py-3 text-sm font-semibold text-foreground"
                >
                  {t("backHome")}
                </Link>
              </div>
            </GlowCard>
          </Reveal>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
