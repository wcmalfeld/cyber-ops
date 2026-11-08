import { register } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="t-h1 mb-1">Create your operator account</h1>
      <p className="text-muted mb-6">Your progress, XP and skill profile are saved to it.</p>
      <AuthForm mode="register" action={register} />
    </>
  );
}
