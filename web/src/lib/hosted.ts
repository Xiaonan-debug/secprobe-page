// Hosted task generation (CONTRACT.md §6). The generator runs in the SecProbe team's private
// repository; the visitor's OpenAI key is sealed in the browser with the team's public key.

import { CONFIG } from "./config";
import { GitHub, sealSecret } from "./github";
import type { TaskDetail } from "./data";
import type { GenProgress } from "./runner";

export interface HostedConfig { enabled: boolean; public_key: string | null; user_daily_limit: number; global_daily_limit: number }
export interface HostedStatus {
  request_id: string;
  status: "pending" | "queued" | "in_progress" | "completed";
  conclusion: string | null;
  created_at: string | null;
  updated_at: string | null;
}
export interface MineRow { request_id: string; created_at: string; summary?: { cwe?: string; language?: string; software_level?: string; difficulty?: string; model?: string } }

export interface GenerateBody {
  cwe: string;
  language: string;
  software_level: string;
  difficulty: "easy" | "medium" | "hard";
  model: string;
  effort: "low" | "medium" | "high";
  online_research: boolean;
  release_gate: boolean;
  controls: Record<string, number>;
}

export class HostedError extends Error {
  constructor(public status: number, message: string, public retryAfter?: number, public code?: string) { super(message); }
}

const ERRORS: Record<string, string> = {
  user_daily_limit_reached: "You have reached today's generation limit.",
  global_daily_limit_reached: "The shared daily generation budget is used up.",
  generation_disabled: "Hosted generation is temporarily paused.",
  storage_unavailable: "The generation service is temporarily unavailable. Please retry shortly.",
  server_misconfigured: "The generation service is not fully configured yet.",
  dispatch_failed: "The generator could not be started. Please retry in a few minutes.",
  unauthorized: "Could not verify your GitHub sign-in. Sign out and in again, or retry if GitHub is having trouble.",
  origin_not_allowed: "This site is not allowed to call the generation service.",
  forbidden: "Only the person who started this generation can cancel it.",
  no_access: "Your GitHub account does not have access to SecProbe generation. Ask the authors to add you as a collaborator.",
  already_completed: "This generation has already finished.",
  run_not_started: "The generation has not started yet; try cancelling again in a moment.",
};

export const hostedAvailable = () => Boolean(CONFIG.apiBase);

async function call<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (init.body) headers["Content-Type"] = "application/json";
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  const res = await fetch(CONFIG.apiBase + path, { ...init, headers, cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new HostedError(res.status, ERRORS[body.error] ?? body.detail ?? body.error ?? res.statusText, body.retry_after, body.error);
  return body as T;
}

export const hostedConfig = () => call<HostedConfig>("/generate/config");
export const hostedStatus = (rid: string) => call<HostedStatus>(`/generate/${encodeURIComponent(rid)}/status`);
export const hostedMine = (token: string) => call<MineRow[]>("/generate/mine", { token });
export const hostedCancel = (token: string, rid: string) =>
  call<{ ok: boolean }>(`/generate/${encodeURIComponent(rid)}/cancel`, { method: "POST", token });

export async function submitGeneration(token: string, publicKey: string, openaiKey: string, body: GenerateBody): Promise<string> {
  const encrypted_key = await sealSecret(publicKey, openaiKey);
  const r = await call<{ request_id: string }>("/generate", { method: "POST", token, body: JSON.stringify({ ...body, encrypted_key }) });
  return r.request_id;
}

/** Read a JSON file from the private results repo using the approved visitor's token. */
export async function readGenerated<T>(gh: GitHub | null, path: string): Promise<T | null> {
  if (gh) return gh.readJson<T>(CONFIG.generatedRepo, path, "main");
  const res = await fetch(`https://api.github.com/repos/${CONFIG.generatedRepo}/contents/${path}?ref=main`, {
    headers: { Accept: "application/vnd.github.raw+json" },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export const generatedProgress = (gh: GitHub | null, rid: string) => readGenerated<GenProgress>(gh, `generated/${rid}/progress.json`);
export const generatedTask = (gh: GitHub | null, rid: string) => readGenerated<TaskDetail>(gh, `generated/${rid}/task.json`);
export const generatedBundleUrl = (rid: string) =>
  `https://raw.githubusercontent.com/${CONFIG.generatedRepo}/main/generated/${rid}/bundle.tar.gz`;

const KEY_STORE = "secprobe.openai.session";
export const sessionKey = {
  get: () => { try { return sessionStorage.getItem(KEY_STORE) ?? ""; } catch { return ""; } },
  set: (v: string | null) => { try { if (v) sessionStorage.setItem(KEY_STORE, v); else sessionStorage.removeItem(KEY_STORE); } catch { /* ignore */ } },
};
