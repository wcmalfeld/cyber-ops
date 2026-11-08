"use client";
import Link from "next/link";
import { useActionState } from "react";
import type { AuthState } from "./actions";

export function AuthForm({ mode, action }: { mode: "login" | "register"; action: (s: AuthState, f: FormData) => Promise<AuthState> }) {
  const [state, formAction, pending] = useActionState(action, {});
  const isRegister = mode === "register";
  return (
    <form action={formAction} className="space-y-4" noValidate>
      {isRegister && (
        <label className="block">
          <span className="t-small text-muted">Call sign</span>
          <input name="displayName" className="field mt-1" autoComplete="nickname" required defaultValue={state.displayName} />
        </label>
      )}
      <label className="block">
        <span className="t-small text-muted">Email</span>
        <input name="email" type="email" className="field mt-1" autoComplete="email" required defaultValue={state.email} />
      </label>
      <label className="block">
        <span className="t-small text-muted">Password{isRegister && " (10+ characters)"}</span>
        <input name="password" type="password" className="field mt-1" autoComplete={isRegister ? "new-password" : "current-password"} required minLength={isRegister ? 10 : undefined} />
      </label>
      {state.error && (
        <p role="alert" className="t-small text-alert">
          {state.error}
        </p>
      )}
      <button className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Working…" : isRegister ? "Create account" : "Sign in"}
      </button>
      <p className="t-small text-muted">
        {isRegister ? (
          <>Already training? <Link className="link" href="/login">Sign in</Link></>
        ) : (
          <>New here? <Link className="link" href="/register">Create an account</Link></>
        )}
      </p>
    </form>
  );
}
