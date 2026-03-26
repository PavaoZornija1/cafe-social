import { SignIn } from "@clerk/nextjs";

export default function OwnerSignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-zinc-100 p-6">
      <p className="text-sm text-zinc-400 mb-6 max-w-md text-center">
        Sign in with the same account your platform admin invited as{" "}
        <span className="text-zinc-200">OWNER</span> or{" "}
        <span className="text-zinc-200">MANAGER</span> for a venue.
      </p>
      <SignIn
        path="/owner/sign-in"
        routing="path"
        signUpUrl="/owner/sign-up"
        forceRedirectUrl="/owner/venues"
        appearance={{
          baseTheme: "dark",
          variables: { colorPrimary: "#7c3aed" },
        }}
      />
    </div>
  );
}
