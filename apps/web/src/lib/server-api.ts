import "server-only";

import { cookies } from "next/headers";

const apiUrl = process.env.INTERNAL_API_URL ?? "http://127.0.0.1:3001";

function cookieHeader(entries: { name: string; value: string }[]) {
  return entries.map(({ name, value }) => `${name}=${encodeURIComponent(value)}`).join("; ");
}

export async function serverApi(path: string) {
  const store = await cookies();
  return fetch(`${apiUrl}${path}`, {
    cache: "no-store",
    headers: { cookie: cookieHeader(store.getAll()) },
  });
}
