import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="portal-auth-bg min-h-screen flex flex-col items-center justify-center p-6 sm:p-10">
      <div className="w-full max-w-[420px] flex flex-col items-center">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-brand-foreground text-base font-bold tracking-tight shadow-lg shadow-brand/35">
            CS
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            Create your account
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 max-w-sm mx-auto">
            Venue access is granted when an owner or super admin adds your email to a venue.
          </p>
        </div>

        <div className="w-full rounded-2xl border border-white/70 bg-white/85 backdrop-blur-md p-6 sm:p-7 shadow-portal-card">
          <SignUp
            path="/sign-up"
            routing="path"
            signInUrl="/sign-in"
            forceRedirectUrl="/dashboard"
            appearance={{
              baseTheme: "light",
              variables: {
                colorPrimary: "#143368",
                colorText: "#111827",
                colorTextSecondary: "#5a7199",
                colorBackground: "transparent",
                colorInputBackground: "#ffffff",
                colorNeutral: "#e2e8f0",
                borderRadius: "0.75rem",
              },
              elements: {
                rootBox: "w-full",
                card: "shadow-none border-0 bg-transparent p-0 gap-6",
                headerTitle: "text-slate-900 font-semibold text-lg",
                headerSubtitle: "text-slate-600 text-sm",
                socialButtonsBlockButton: "border-slate-200",
                formButtonPrimary:
                  "bg-brand hover:bg-brand-hover text-sm font-semibold shadow-md shadow-brand/20",
              },
            }}
          />
        </div>

        <p className="mt-8 text-center text-xs text-brand-muted">
          Cafe Social · secure sign-up
        </p>
      </div>
    </div>
  );
}
