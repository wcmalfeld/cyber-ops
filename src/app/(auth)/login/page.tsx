import { getCurrentUser } from "@/server/auth";
import { login } from "../actions";
import { AuthForm } from "../auth-form";
import { GuestButton, OrDivider } from "../guest-button";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  return (
    <>
      {!user && (
        <>
          <h1 className="t-h1 mb-1">Start training</h1>
          <p className="text-muted mb-6">Jump straight into Mission 1 from your browser.</p>
          <GuestButton />
          <OrDivider />
        </>
      )}
      <h2 className={user ? "t-h1 mb-1" : "t-h2 mb-1"}>Sign in</h2>
      <p className="text-muted mb-6">
        {user ? "Signing in switches to your account. Your current guest progress is not merged into it." : "Pick up where you left off."}
      </p>
      <AuthForm mode="login" action={login} />
    </>
  );
}
