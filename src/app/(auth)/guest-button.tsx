"use client";
import { useActionState } from "react";
import { playAsGuest } from "./actions";

export function GuestButton() {
  const [state, formAction, pending] = useActionState(playAsGuest, {});
  return (
    <form action={formAction} className="space-y-2">
      <button className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Preparing workstation…" : "Play now as guest"}
      </button>
      <p className="t-micro text-muted">No sign-up needed. Progress is kept on this browser, and you can save it to an account at any time.</p>
      {state.error && (
        <p role="alert" className="t-small text-alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3 my-6" aria-hidden="true">
      <span className="h-px flex-1 bg-rule" />
      <span className="t-micro text-muted">or</span>
      <span className="h-px flex-1 bg-rule" />
    </div>
  );
}
