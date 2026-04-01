import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-zinc-100 p-6">
      <p className="text-sm text-zinc-400 mb-6 max-w-md text-center">
        Create an account. Venue access is granted when an OWNER or super admin
        adds your email to a venue.
      </p>
      <SignUp
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
        forceRedirectUrl="/dashboard"
        appearance={{
          baseTheme: "dark",
          variables: { colorPrimary: "#7c3aed" },
        }}
      />
    </div>
  );
}
