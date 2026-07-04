/**
 * Public legal pages on this portal (`/privacy`, `/terms`).
 * Override branding via env — no auth required.
 */
export function legalConfig() {
  const companyName =
    process.env.NEXT_PUBLIC_LEGAL_COMPANY_NAME?.trim() || "Cafe Social";
  const contactEmail =
    process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL?.trim() || "privacy@cafesocial.app";
  const effectiveDate =
    process.env.NEXT_PUBLIC_LEGAL_EFFECTIVE_DATE?.trim() || "2026-07-01";
  const appName = process.env.NEXT_PUBLIC_LEGAL_APP_NAME?.trim() || "Cafe Social";

  return { companyName, contactEmail, effectiveDate, appName };
}
