import { getToken, pageRole } from "./auth";
// Small fetch wrapper: adds the login token and turns failures into readable errors.
const API = process.env.NEXT_PUBLIC_API_URL;

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken(pageRole());
  const res = await fetch(`${API}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = typeof data?.detail === "string" ? data.detail : "Something went wrong. Please try again.";
    throw new ApiError(res.status, res.status >= 500 ? "The server is having trouble right now. Please try again." : detail);
  }
  return data as T;
}
