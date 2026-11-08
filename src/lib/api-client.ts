/** Typed JSON POST helper for the game API (same-origin, cookie auth). */
export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function api<T>(path: string, body?: unknown, method: "POST" | "GET" = "POST"): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
    body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({ error: "Unexpected response from server" }));
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status);
  return data as T;
}
