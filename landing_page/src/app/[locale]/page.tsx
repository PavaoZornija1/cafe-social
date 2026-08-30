import { setRequestLocale } from "next-intl/server";
import { SiteNav } from "@/components/SiteNav";
import { HeroSection } from "@/components/HeroSection";
import { PartnerStageSection } from "@/components/PartnerStageSection";
import { ProductStorySection } from "@/components/ProductStorySection";
import { GamesSection } from "@/components/GamesSection";
import { ValuesSection } from "@/components/ValuesSection";
import { VisitStepsSection } from "@/components/VisitStepsSection";
import { PartnerCtaSection } from "@/components/PartnerCtaSection";
import { FaqSection } from "@/components/FaqSection";
import { DownloadSection } from "@/components/DownloadSection";
import { SiteFooter } from "@/components/SiteFooter";
import { SectionDivider } from "@/components/SectionHeader";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <SiteNav />
      <main>
        <HeroSection />
        <SectionDivider />
        <PartnerStageSection />
        <ProductStorySection />
        <SectionDivider />
        <GamesSection />
        <ValuesSection />
        <VisitStepsSection />
        <SectionDivider />
        <PartnerCtaSection />
        <FaqSection />
        <DownloadSection />
      </main>
      <SiteFooter />
    </>
  );
}
