import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth";
import { saveGuestProgress } from "../../(auth)/actions";
import { AuthForm } from "../../(auth)/auth-form";

export const metadata = { title: "Save progress" };

export default async function SavePage() {
  const user = await requireUser();
  if (!user.isGuest) redirect("/");
  return (
    <div className="max-w-sm">
      <h1 className="t-h1 mb-1">Save your progress</h1>
      <p className="text-muted mb-6">
        Add an email and password to keep your XP, missions and skill profile, and to sign in from any device.
      </p>
      <AuthForm mode="claim" action={saveGuestProgress} />
    </div>
  );
}
