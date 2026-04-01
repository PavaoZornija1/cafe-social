import { redirect } from "next/navigation";

export default function LegacyOwnerSignUpRedirect() {
  redirect("/sign-up");
}
