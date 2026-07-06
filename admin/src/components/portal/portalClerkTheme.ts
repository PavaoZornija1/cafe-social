/** Shared Clerk appearance + layout for auth pages and ClerkProvider defaults. */

export const portalClerkLayout = {
  logoPlacement: "none" as const,
  socialButtonsPlacement: "bottom" as const,
  socialButtonsVariant: "blockButton" as const,
  showOptionalFields: false,
};

export const portalClerkAppearance = {
  baseTheme: "light" as const,
  layout: portalClerkLayout,
  variables: {
    colorPrimary: "#143368",
    colorText: "#111827",
    colorTextSecondary: "#5a7199",
    colorBackground: "transparent",
    colorInputBackground: "#ffffff",
    colorInputText: "#111827",
    colorNeutral: "#e2e8f0",
    colorDanger: "#b91c1c",
    colorSuccess: "#047857",
    borderRadius: "0.75rem",
    fontSize: "0.875rem",
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    spacingUnit: "0.9rem",
  },
  elements: {
    rootBox: "w-full font-sans",
    cardBox: "w-full shadow-none",
    card: "shadow-none border-0 bg-transparent p-0 gap-0 w-full",

    // Shell already shows title/subtitle — hide Clerk duplicates
    header: "hidden",
    headerTitle: "hidden",
    headerSubtitle: "hidden",
    logoBox: "hidden",
    logoImage: "hidden",

    main: "gap-5",

    socialButtons: "gap-2.5",
    socialButtonsBlockButton:
      "h-11 rounded-xl border border-slate-300 bg-white text-slate-900 shadow-sm hover:bg-slate-50 hover:border-slate-400 transition-colors [&_*]:text-slate-900",
    socialButtonsBlockButtonText: "text-sm font-semibold text-slate-900",
    socialButtonsBlockButtonArrow: "text-slate-500",
    socialButtonsProviderIcon: "opacity-100",

    dividerRow: "my-1",
    dividerLine: "bg-slate-200/90",
    dividerText: "text-xs font-medium uppercase tracking-wide text-slate-400 px-2",

    form: "gap-4",
    formFieldRow: "gap-1.5",
    formFieldLabel: "text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500",
    formFieldInput:
      "h-11 rounded-xl border-2 border-slate-300 bg-white text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-brand/20",
    formFieldInputShowPasswordButton: "text-brand-muted hover:text-brand",
    formFieldAction: "mt-1",
    formFieldActionLink: "text-xs font-medium text-brand hover:text-brand-hover",

    formButtonPrimary:
      "h-11 rounded-xl bg-brand text-sm font-semibold text-brand-foreground shadow-md shadow-brand/25 hover:bg-brand-hover transition-colors",
    formButtonReset:
      "text-sm font-medium text-brand-muted hover:text-brand transition-colors",

    footer: "bg-transparent pt-2",
    footerAction: "justify-center",
    footerActionText: "text-sm text-slate-500",
    footerActionLink: "text-sm font-semibold text-brand hover:text-brand-hover",

    identityPreview: "rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-2.5",
    identityPreviewText: "text-sm font-medium text-slate-800",
    identityPreviewEditButton: "text-xs font-semibold text-brand hover:text-brand-hover",

    formResendCodeLink: "text-sm font-medium text-brand hover:text-brand-hover",

    alert: "rounded-xl border px-3 py-2.5 text-sm",
    alertText: "text-sm leading-relaxed",

    otpCodeFieldInputs: "justify-center gap-2",
    otpCodeFieldInput:
      "h-11 w-11 rounded-xl border-2 border-slate-300 bg-white text-base font-semibold text-slate-900 shadow-sm focus:border-brand focus:ring-2 focus:ring-brand/20",

    alternativeMethodsBlockButton:
      "rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors",

    backLink: "text-sm font-medium text-brand-muted hover:text-brand",
    backRow: "mb-1",
    navbar: "hidden",
    navbarButton: "hidden",

    formHeaderTitle: "text-lg font-semibold text-slate-900",
    formHeaderSubtitle: "text-sm text-slate-600",

    badge: "rounded-md bg-brand-lighter text-brand text-[10px] font-semibold uppercase tracking-wide",
  },
};
