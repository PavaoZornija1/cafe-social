import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function OwnerEntryPage() {
  const { userId } = await auth();
  if (userId) redirect("/owner/venues");
  redirect("/owner/sign-in");
}
