import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { register } from "../actions";
import { AuthForm } from "../auth-form";
import { GuestButton, OrDivider } from "../guest-button";

export const metadata = { title: "Create account" };

export default async function RegisterPage() {
  // A guest creating an account should keep their progress: claim, don't register.
  if ((await getCurrentUser())?.isGuest) redirect("/save");
  return (
    <>
      <h1 className="t-h1 mb-1">Create your operator account</h1>
      <p className="text-muted mb-6">Your progress, XP and skill profile are saved to it.</p>
      <AuthForm mode="register" action={register} />
      <OrDivider />
      <GuestButton />
    </>
  );
}
