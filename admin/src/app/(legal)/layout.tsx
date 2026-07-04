import type { Metadata } from "next";
import { legalConfig } from "@/lib/legalConfig";

export const metadata: Metadata = {
  title: {
    template: `%s · ${legalConfig().appName}`,
    default: legalConfig().appName,
  },
  robots: { index: true, follow: true },
};

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
