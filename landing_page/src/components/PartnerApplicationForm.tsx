"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { submitPartnerApplication } from "@/lib/partnerApplicationApi";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

export function PartnerApplicationForm() {
  const t = useTranslations("partnersPage.applicationForm");
  const [applicantName, setApplicantName] = useState("");
  const [applicantEmail, setApplicantEmail] = useState("");
  const [applicantPhone, setApplicantPhone] = useState("");
  const [venueName, setVenueName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await submitPartnerApplication({
        applicantName: applicantName.trim(),
        applicantEmail: applicantEmail.trim(),
        venueName: venueName.trim(),
        address: address.trim(),
        city: city.trim(),
        country: country.trim(),
        ...(applicantPhone.trim() && { applicantPhone: applicantPhone.trim() }),
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div
        className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-10 text-center"
        role="status"
      >
        <h2 className="text-xl font-bold text-foreground">{t("successTitle")}</h2>
        <p className="mt-3 text-sm leading-relaxed text-text-secondary">{t("successBody")}</p>
      </div>
    );
  }

  return (
    <form
      id="apply"
      className="scroll-mt-28 rounded-3xl border border-border bg-surface p-6 sm:p-8 space-y-5"
      onSubmit={(e) => void onSubmit(e)}
    >
      <div>
        <h2 className="text-2xl font-bold">{t("title")}</h2>
        <p className="mt-2 text-sm text-text-secondary">{t("lead")}</p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-800 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-foreground">{t("applicantName")}</span>
          <input
            required
            className={inputClass}
            value={applicantName}
            onChange={(e) => setApplicantName(e.target.value)}
            autoComplete="name"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-foreground">{t("email")}</span>
          <input
            required
            type="email"
            className={inputClass}
            value={applicantEmail}
            onChange={(e) => setApplicantEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-foreground">{t("phone")}</span>
          <input
            type="tel"
            className={inputClass}
            value={applicantPhone}
            onChange={(e) => setApplicantPhone(e.target.value)}
            autoComplete="tel"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-foreground">{t("venueName")}</span>
          <input
            required
            className={inputClass}
            value={venueName}
            onChange={(e) => setVenueName(e.target.value)}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-foreground">{t("address")}</span>
          <input
            required
            className={inputClass}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            autoComplete="street-address"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-foreground">{t("country")}</span>
          <input
            required
            className={inputClass}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder={t("countryPlaceholder")}
            autoComplete="country-name"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-foreground">{t("city")}</span>
          <input
            required
            className={inputClass}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            autoComplete="address-level2"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {submitting ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
