import { login } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <h1 className="t-h1 mb-1">Sign in</h1>
      <p className="text-muted mb-6">Pick up where you left off.</p>
      <AuthForm mode="login" action={login} />
    </>
  );
}
