// Access to all site content goes through the visitor's GitHub token: files are read from the private
// data repository, so only its collaborators can load anything.
import { CONFIG } from "./config";

let token: string | null = null;
const cache = new Map<string, Promise<unknown>>();

export function setContentToken(t: string | null) {
  if (t !== token) cache.clear();
  token = t;
}

export class NoAccessError extends Error {}

async function fetchJson<T>(path: string, missingOk: boolean): Promise<T | null> {
  if (CONFIG.localData) {
    const base = import.meta.env.BASE_URL.replace(/\/?$/, "/");
    const r = await fetch(base + "data/" + path);
    if (r.status === 404 && missingOk) return null;
    if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
    return r.json() as Promise<T>;
  }
  if (!token) throw new NoAccessError("Sign in to view SecProbe.");
  const r = await fetch(`https://api.github.com/repos/${CONFIG.dataRepo}/contents/data/${path}?ref=main`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.raw+json", "X-GitHub-Api-Version": "2022-11-28" },
  });
  if (r.status === 404 && missingOk) return null;
  if (r.status === 401 || r.status === 403 || r.status === 404) throw new NoAccessError(`No access to ${path}`);
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json() as Promise<T>;
}

/** Cached JSON from the content store. `missingOk` resolves to null for files that do not exist. */
export function loadContent<T>(path: string, missingOk = false): Promise<T | null> {
  const key = `${missingOk}:${path}`;
  let p = cache.get(key) as Promise<T | null> | undefined;
  if (!p) {
    p = fetchJson<T>(path, missingOk);
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

/** True when the signed-in visitor can read the data repository. */
export async function checkAccess(t: string): Promise<boolean> {
  if (CONFIG.localData) return true;
  const r = await fetch(`https://api.github.com/repos/${CONFIG.dataRepo}`, {
    headers: { Authorization: `Bearer ${t}`, Accept: "application/vnd.github+json" },
    cache: "no-store",
  });
  return r.ok;
}
