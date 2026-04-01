import { redirect } from "next/navigation";

/** Old bookmarks: /owner/sign-in → unified portal sign-in. */
export default function LegacyOwnerSignInRedirect() {
  redirect("/sign-in");
}
