import { SignUp } from "@clerk/nextjs";

export default function OwnerSignUpPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-zinc-100 p-6">
      <p className="text-sm text-zinc-400 mb-6 max-w-md text-center">
        Create an account, then ask your Cafe Social operator to add your email
        to the venue staff list with OWNER or MANAGER access.
      </p>
      <SignUp
        path="/owner/sign-up"
        routing="path"
        signInUrl="/owner/sign-in"
        forceRedirectUrl="/owner/venues"
        appearance={{
          baseTheme: "dark",
          variables: { colorPrimary: "#7c3aed" },
        }}
      />
    </div>
  );
}
