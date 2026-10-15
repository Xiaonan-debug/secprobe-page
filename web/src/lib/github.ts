// Thin GitHub REST client used from the browser with the visitor's own token.
// The token never leaves the browser except to api.github.com (and, once, the OAuth exchange worker).

import { CONFIG } from "./config";

const API = "https://api.github.com";

export class GitHubError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface GhUser { login: string; avatar_url: string; name: string | null; html_url: string }
export interface GhRepo { full_name: string; html_url: string; private: boolean; default_branch: string; owner: { login: string } }
export interface GhRun {
  id: number;
  name: string;
  display_title: string;
  status: "queued" | "in_progress" | "completed" | "waiting" | "requested" | "pending";
  conclusion: null | "success" | "failure" | "cancelled" | "skipped" | "timed_out" | "neutral" | "action_required";
  html_url: string;
  created_at: string;
  updated_at: string;
  run_started_at?: string;
  path: string;
}
export interface GhStep { name: string; status: string; conclusion: string | null; number: number; started_at: string | null; completed_at: string | null }
export interface GhJob {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
  html_url: string;
  steps?: GhStep[];
}

export class GitHub {
  constructor(private token: string) {}

  async req<T>(path: string, init: RequestInit & { raw?: boolean } = {}): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      Accept: init.raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (init.body) headers["Content-Type"] = "application/json";
    const res = await fetch(path.startsWith("http") ? path : API + path, { ...init, headers, cache: "no-store" });
    if (!res.ok) {
      let msg = res.statusText;
      try { msg = (await res.json()).message || msg; } catch { /* keep statusText */ }
      throw new GitHubError(res.status, msg);
    }
    if (res.status === 204) return undefined as T;
    return (init.raw ? res.text() : res.json()) as Promise<T>;
  }

  user() { return this.req<GhUser>("/user"); }

  async scopes(): Promise<string[]> {
    const res = await fetch(API + "/user", { headers: { Authorization: `Bearer ${this.token}` } });
    return (res.headers.get("x-oauth-scopes") || "").split(",").map((s) => s.trim()).filter(Boolean);
  }

  async repo(full: string): Promise<GhRepo | null> {
    try { return await this.req<GhRepo>(`/repos/${full}`); }
    catch (e) { if (e instanceof GitHubError && e.status === 404) return null; throw e; }
  }

  createFromTemplate(owner: string, name: string, isPrivate: boolean) {
    return this.req<GhRepo>(`/repos/${CONFIG.templateRepo}/generate`, {
      method: "POST",
      body: JSON.stringify({
        owner, name, private: isPrivate, include_all_branches: false,
        description: "My SecProbe runner: evaluates coding agents and synthesizes tasks with my own API keys.",
      }),
    });
  }

  /**
   * Create the visitor's runner. GitHub only lets the template's owner (or org members) generate from a
   * private template, so collaborators get an empty private repo that is then filled from the template.
   */
  async createRunner(owner: string, name: string, isPrivate: boolean): Promise<GhRepo> {
    try {
      return await this.createFromTemplate(owner, name, isPrivate);
    } catch (e) {
      if (!(e instanceof GitHubError) || ![403, 404, 422].includes(e.status)) throw e;
      if (e.status === 422 && (await this.repo(`${owner}/${name}`))) throw e; // name already taken
    }
    const repo = await this.req<GhRepo>("/user/repos", {
      method: "POST",
      body: JSON.stringify({
        name, private: isPrivate, auto_init: true,
        description: "My SecProbe runner: evaluates coding agents with my own API keys.",
      }),
    });
    // auto_init's first commit can take a moment to become visible.
    for (let i = 0; i < 15; i++) {
      try { await this.req(`/repos/${repo.full_name}/git/ref/heads/${repo.default_branch || "main"}`); break; }
      catch { await new Promise((r) => setTimeout(r, 1500)); }
    }
    await this.syncFromTemplate(repo.full_name, repo.default_branch || "main");
    return repo;
  }

  async workflowsReady(full: string): Promise<boolean> {
    try {
      const r = await this.req<{ workflows: { path: string; state: string }[] }>(`/repos/${full}/actions/workflows`);
      const names = r.workflows.map((w) => w.path);
      return names.some((p) => p.endsWith("evaluate.yml"));
    } catch { return false; }
  }

  async secretNames(full: string): Promise<string[]> {
    const r = await this.req<{ secrets: { name: string }[] }>(`/repos/${full}/actions/secrets?per_page=100`);
    return r.secrets.map((s) => s.name);
  }

  async putSecret(full: string, name: string, value: string) {
    const key = await this.req<{ key_id: string; key: string }>(`/repos/${full}/actions/secrets/public-key`);
    const encrypted = await sealSecret(key.key, value);
    await this.req(`/repos/${full}/actions/secrets/${name}`, {
      method: "PUT",
      body: JSON.stringify({ encrypted_value: encrypted, key_id: key.key_id }),
    });
  }

  deleteSecret(full: string, name: string) {
    return this.req(`/repos/${full}/actions/secrets/${name}`, { method: "DELETE" });
  }

  dispatch(full: string, workflow: string, inputs: Record<string, string>, ref = "main") {
    return this.req(`/repos/${full}/actions/workflows/${workflow}/dispatches`, {
      method: "POST",
      body: JSON.stringify({ ref, inputs }),
    });
  }

  async runs(full: string, workflow?: string, perPage = 30): Promise<GhRun[]> {
    const path = workflow
      ? `/repos/${full}/actions/workflows/${workflow}/runs?per_page=${perPage}`
      : `/repos/${full}/actions/runs?event=workflow_dispatch&per_page=${perPage}`;
    const r = await this.req<{ workflow_runs: GhRun[] }>(path);
    return r.workflow_runs;
  }

  run(full: string, id: number) { return this.req<GhRun>(`/repos/${full}/actions/runs/${id}`); }

  async jobs(full: string, runId: number): Promise<GhJob[]> {
    const out: GhJob[] = [];
    for (let page = 1; page < 5; page++) {
      const r = await this.req<{ jobs: GhJob[]; total_count: number }>(
        `/repos/${full}/actions/runs/${runId}/jobs?per_page=100&page=${page}`,
      );
      out.push(...r.jobs);
      if (out.length >= r.total_count || r.jobs.length === 0) break;
    }
    return out;
  }

  /** Runner template version (VERSION file); "1" when the file predates versioning. */
  async runnerVersion(full: string): Promise<string> {
    return ((await this.readFile(full, "VERSION", "main")) ?? "1").trim();
  }

  /**
   * Bring the visitor's runner up to date with the template: copies every template file whose
   * content differs into one commit on the runner's default branch. Files only in the runner are kept.
   */
  async syncFromTemplate(full: string, branch = "main"): Promise<number> {
    type Tree = { sha: string; tree: { path: string; mode: string; type: string; sha: string }[] };
    const tpl = await this.req<Tree>(`/repos/${CONFIG.templateRepo}/git/trees/main?recursive=1`);
    const ref = await this.req<{ object: { sha: string } }>(`/repos/${full}/git/ref/heads/${branch}`);
    const head = await this.req<{ tree: { sha: string } }>(`/repos/${full}/git/commits/${ref.object.sha}`);
    const mine = await this.req<Tree>(`/repos/${full}/git/trees/${head.tree.sha}?recursive=1`);
    const have = new Map(mine.tree.map((e) => [e.path, e.sha]));
    const changed = tpl.tree.filter((e) => e.type === "blob" && have.get(e.path) !== e.sha);
    if (!changed.length) return 0;
    const entries = [];
    for (const e of changed) {
      const blob = await this.req<{ content: string }>(`/repos/${CONFIG.templateRepo}/git/blobs/${e.sha}`);
      const created = await this.req<{ sha: string }>(`/repos/${full}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({ content: blob.content.replace(/\n/g, ""), encoding: "base64" }),
      });
      entries.push({ path: e.path, mode: e.mode, type: "blob", sha: created.sha });
    }
    const tree = await this.req<{ sha: string }>(`/repos/${full}/git/trees`, {
      method: "POST", body: JSON.stringify({ base_tree: head.tree.sha, tree: entries }),
    });
    const commit = await this.req<{ sha: string }>(`/repos/${full}/git/commits`, {
      method: "POST",
      body: JSON.stringify({ message: "Install SecProbe runner from template", tree: tree.sha, parents: [ref.object.sha] }),
    });
    await this.req(`/repos/${full}/git/refs/heads/${branch}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha }) });
    return changed.length;
  }

  cancel(full: string, runId: number) {
    return this.req(`/repos/${full}/actions/runs/${runId}/cancel`, { method: "POST" });
  }

  /** Download a (possibly private) repository file through the API and hand it to the browser as a file. */
  async downloadFile(full: string, path: string, filename: string, ref = "main") {
    const res = await fetch(`${API}/repos/${full}/contents/${path}?ref=${encodeURIComponent(ref)}`, {
      headers: { Authorization: `Bearer ${this.token}`, Accept: "application/vnd.github.raw+json" },
    });
    if (!res.ok) throw new GitHubError(res.status, `Download failed (HTTP ${res.status})`);
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  /** Read a file from the results branch; null if it does not exist yet. */
  async readFile(full: string, path: string, ref = CONFIG.resultsBranch): Promise<string | null> {
    try {
      return await this.req<string>(`/repos/${full}/contents/${path}?ref=${encodeURIComponent(ref)}`, { raw: true });
    } catch (e) {
      if (e instanceof GitHubError && (e.status === 404 || e.status === 409)) return null;
      throw e;
    }
  }

  async readJson<T>(full: string, path: string, ref?: string): Promise<T | null> {
    const t = await this.readFile(full, path, ref);
    return t == null ? null : (JSON.parse(t) as T);
  }
}

export async function sealSecret(publicKeyB64: string, value: string): Promise<string> {
  let sodium: typeof import("libsodium-wrappers");
  try {
    sodium = (await import("libsodium-wrappers")).default;
  } catch {
    throw new Error("This site was just updated. Please refresh the page (you stay signed in) and try again.");
  }
  await sodium.ready;
  const key = sodium.from_base64(publicKeyB64, sodium.base64_variants.ORIGINAL);
  const sealed = sodium.crypto_box_seal(sodium.from_string(value), key);
  return sodium.to_base64(sealed, sodium.base64_variants.ORIGINAL);
}

/* ---------------- OAuth (web flow through the exchange worker) ---------------- */

const STATE_KEY = "secprobe.oauth.state";
const RETURN_KEY = "secprobe.oauth.return";

export const oauthAvailable = () => Boolean(CONFIG.githubClientId && CONFIG.apiBase);

export function beginOAuth(returnHash: string) {
  const state = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
  sessionStorage.setItem(STATE_KEY, state);
  sessionStorage.setItem(RETURN_KEY, returnHash);
  const redirect = location.origin + location.pathname;
  const u = new URL("https://github.com/login/oauth/authorize");
  u.searchParams.set("client_id", CONFIG.githubClientId);
  u.searchParams.set("scope", "repo workflow");
  u.searchParams.set("state", state);
  u.searchParams.set("redirect_uri", redirect);
  u.searchParams.set("allow_signup", "true");
  location.assign(u.toString());
}

/** If the page was opened by GitHub's OAuth redirect, finish the exchange and return the token. */
export async function completeOAuth(): Promise<{ token: string; returnHash: string } | null> {
  const params = new URLSearchParams(location.search);
  const code = params.get("code");
  const state = params.get("state");
  if (!code) return null;
  const expected = sessionStorage.getItem(STATE_KEY);
  const returnHash = sessionStorage.getItem(RETURN_KEY) || "#/evaluate";
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(RETURN_KEY);
  history.replaceState(null, "", location.pathname + returnHash);
  if (!expected || state !== expected) throw new Error("GitHub sign-in was interrupted (state mismatch). Please try again.");
  const res = await fetch(CONFIG.apiBase + "/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) throw new Error(body.error || "GitHub sign-in failed.");
  return { token: body.access_token as string, returnHash };
}
