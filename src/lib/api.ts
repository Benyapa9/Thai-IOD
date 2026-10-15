/** Dates arrive as ISO strings over JSON. */
export type Jsonify<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Jsonify<U>[]
    : T extends object
      ? { [K in keyof T]: Jsonify<T[K]> }
      : T;

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

export function qs(params: Record<string, string | undefined>) {
  const entries = Object.entries(params).filter(([, v]) => v) as [string, string][];
  return entries.length ? `?${new URLSearchParams(entries)}` : "";
}

export const api = {
  get: <T>(url: string) => fetch(url, { cache: "no-store" }).then((r) => parse<T>(r)),
  send: <T>(url: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown) =>
    fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }).then((r) => parse<T>(r)),
  upload: <T>(url: string, form: FormData) =>
    fetch(url, { method: "POST", body: form }).then((r) => parse<T>(r)),
};
