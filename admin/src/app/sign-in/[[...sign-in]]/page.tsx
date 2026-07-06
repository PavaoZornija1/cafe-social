import { SignIn } from "@clerk/nextjs";
import { PortalAuthShell, portalClerkAppearance } from "@/components/portal/PortalAuthShell";

export default function SignInPage() {
  return (
    <PortalAuthShell
      title="Sign in"
      subtitle="Sign in for venue staff and platform administrators."
      footer="Cafe Social · secure sign-in"
      sideTitle="Run your venues with clarity"
      sideLead="Access analytics, team tools, and venue management from one modern partner portal."
      sidePoints={[
        "Real-time redemptions and visitor insights",
        "Role-based access for owners, managers, and staff",
        "Platform tools for super administrators",
      ]}
    >
      <SignIn
        path="/sign-in"
        routing="path"
        signUpUrl="/sign-up"
        forceRedirectUrl="/dashboard"
        appearance={portalClerkAppearance}
      />
    </PortalAuthShell>
  );
}
