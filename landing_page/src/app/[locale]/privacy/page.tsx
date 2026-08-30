import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { siteConfig } from "@/lib/config";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { GlowCard } from "@/components/GlowCard";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("legal");

  return {
    title: t("privacyTitle"),
  };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("legal");

  return (
    <>
      <SiteNav />
      <main className="px-4 pb-20 pt-28 sm:px-6 lg:px-8">
        <GlowCard
          as="article"
          className="mx-auto max-w-3xl rounded-3xl border border-border bg-surface p-8"
        >
          <h1 className="text-3xl font-bold">{t("privacyTitle")}</h1>
          <p className="mt-6 leading-relaxed text-text-secondary">
            {t("privacyBody", { email: siteConfig.contactEmail })}
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex text-sm font-semibold text-primary hover:text-primary-dark"
          >
            {t("backHome")} →
          </Link>
        </GlowCard>
      </main>
      <SiteFooter />
    </>
  );
}
