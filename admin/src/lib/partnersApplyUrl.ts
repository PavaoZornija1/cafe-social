/** Public partner apply form lives on the marketing site (`landing_page/`), not the admin app. */
export function partnersApplyUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_LANDING_PARTNERS_APPLY_URL?.trim();
  if (fromEnv) return fromEnv;
  return "http://localhost:3001/partners#apply";
}

export function redirectToPartnersApply(): void {
  if (typeof window !== "undefined") {
    window.location.assign(partnersApplyUrl());
  }
}
