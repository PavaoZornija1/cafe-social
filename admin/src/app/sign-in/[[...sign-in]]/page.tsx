import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-zinc-100 p-6">
      <p className="text-sm text-zinc-400 mb-6 max-w-md text-center">
        Sign in to the Cafe Social partner portal (venue staff or platform
        administrators).
      </p>
      <SignIn
        path="/sign-in"
        routing="path"
        signUpUrl="/sign-up"
        forceRedirectUrl="/dashboard"
        appearance={{
          baseTheme: "dark",
          variables: { colorPrimary: "#7c3aed" },
        }}
      />
    </div>
  );
}
