"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";

export function StartButton({ missionId, label }: { missionId: string; label: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        className="btn btn-primary"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          try {
            await api(`/api/missions/${missionId}/start`);
            router.push(`/missions/${missionId}/play`);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Could not start the mission");
            setPending(false);
          }
        }}
      >
        {pending ? "Opening workspace…" : label}
      </button>
      {error && <p role="alert" className="t-small text-alert mt-2">{error}</p>}
    </div>
  );
}
