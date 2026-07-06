import { SignUp } from "@clerk/nextjs";
import { PortalAuthShell, portalClerkAppearance } from "@/components/portal/PortalAuthShell";

export default function SignUpPage() {
  return (
    <PortalAuthShell
      title="Create your account"
      subtitle="Venue access is granted when an owner or super admin adds your email to a venue."
      footer="Cafe Social · secure sign-up"
      sideTitle="Join the partner network"
      sideLead="Create your account first — your venue invitation links everything together automatically."
      sidePoints={[
        "Owners and managers get full venue dashboards",
        "Staff receive focused tools for daily operations",
        "Billing and subscriptions managed per organization",
      ]}
    >
      <SignUp
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
        forceRedirectUrl="/dashboard"
        appearance={portalClerkAppearance}
      />
    </PortalAuthShell>
  );
}
