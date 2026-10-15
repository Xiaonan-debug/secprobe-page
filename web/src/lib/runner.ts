// Runner-level vocabulary: providers, harnesses, model presets, result shapes (CONTRACT.md §3).

import { CONFIG } from "./config";
import { GitHub, GhRun } from "./github";
import { requestId } from "./format";

export interface Provider { id: string; label: string; secret: string; prefix: string; keyUrl: string; placeholder: string }

export const PROVIDERS: Provider[] = [
  { id: "openrouter", label: "OpenRouter", secret: "OPENROUTER_API_KEY", prefix: "openrouter/", keyUrl: "https://openrouter.ai/keys", placeholder: "sk-or-v1-…" },
  { id: "openai", label: "OpenAI", secret: "OPENAI_API_KEY", prefix: "openai/", keyUrl: "https://platform.openai.com/api-keys", placeholder: "sk-…" },
  { id: "anthropic", label: "Anthropic", secret: "ANTHROPIC_API_KEY", prefix: "anthropic/", keyUrl: "https://console.anthropic.com/settings/keys", placeholder: "sk-ant-…" },
  { id: "gemini", label: "Google Gemini", secret: "GEMINI_API_KEY", prefix: "gemini/", keyUrl: "https://aistudio.google.com/apikey", placeholder: "AIza…" },
  { id: "deepseek", label: "DeepSeek", secret: "DEEPSEEK_API_KEY", prefix: "deepseek/", keyUrl: "https://platform.deepseek.com/api_keys", placeholder: "sk-…" },
  { id: "moonshot", label: "Moonshot (Kimi)", secret: "MOONSHOT_API_KEY", prefix: "moonshot/", keyUrl: "https://platform.moonshot.ai/console/api-keys", placeholder: "sk-…" },
  { id: "zai", label: "Z.ai (GLM)", secret: "ZAI_API_KEY", prefix: "zai/", keyUrl: "https://z.ai/manage-apikey/apikey-list", placeholder: "…" },
  { id: "dashscope", label: "Alibaba DashScope (Qwen)", secret: "DASHSCOPE_API_KEY", prefix: "dashscope/", keyUrl: "https://dashscope.console.aliyun.com/apiKey", placeholder: "sk-…" },
  { id: "mistral", label: "Mistral", secret: "MISTRAL_API_KEY", prefix: "mistral/", keyUrl: "https://console.mistral.ai/api-keys", placeholder: "…" },
  { id: "minimax", label: "MiniMax", secret: "MINIMAX_API_KEY", prefix: "minimax/", keyUrl: "https://www.minimax.io/platform", placeholder: "…" },
  { id: "together", label: "Together AI", secret: "TOGETHER_API_KEY", prefix: "together_ai/", keyUrl: "https://api.together.ai/settings/api-keys", placeholder: "…" },
  { id: "fireworks", label: "Fireworks", secret: "FIREWORKS_API_KEY", prefix: "fireworks_ai/", keyUrl: "https://fireworks.ai/account/api-keys", placeholder: "fw_…" },
  { id: "xai", label: "xAI", secret: "XAI_API_KEY", prefix: "xai/", keyUrl: "https://console.x.ai", placeholder: "xai-…" },
  // Not a model provider: grants the runner access to the private task dataset.
  { id: "ghgen", label: "GitHub token (generated tasks)", secret: "SECPROBE_GITHUB_TOKEN", prefix: "\u0000gh/", keyUrl: "https://github.com/settings/personal-access-tokens/new", placeholder: "github_pat_…" },
  { id: "hf", label: "Hugging Face (task dataset access)", secret: "HF_TOKEN", prefix: "\u0000hf/", keyUrl: "https://huggingface.co/settings/tokens", placeholder: "hf_…" },
];

export const providerForModel = (model: string): Provider | undefined =>
  PROVIDERS.find((p) => model.startsWith(p.prefix));

export interface Harness { id: string; label: string; note: string; paper?: boolean; providers?: string[]; noModel?: boolean }

export const HARNESSES: Harness[] = [
  { id: "terminus-2", label: "Terminus-2", note: "Terminal-native agent from Terminal-Bench. Used in the paper.", paper: true },
  { id: "mini-swe-agent", label: "Mini-SWE-Agent", note: "Minimal bash-only SWE agent. Used in the paper.", paper: true },
  { id: "claude-code", label: "Claude Code", note: "Anthropic's coding agent CLI.", providers: ["anthropic"] },
  { id: "codex", label: "Codex CLI", note: "OpenAI's coding agent CLI.", providers: ["openai"] },
  { id: "gemini-cli", label: "Gemini CLI", note: "Google's coding agent CLI.", providers: ["gemini"] },
  { id: "openhands", label: "OpenHands", note: "Open platform for software agents." },
  { id: "opencode", label: "OpenCode", note: "Open-source terminal coding agent." },
  { id: "goose", label: "Goose", note: "Block's open-source agent." },
  { id: "aider", label: "Aider", note: "Pair-programming agent." },
  { id: "qwen-coder", label: "Qwen Code", note: "Qwen's coding agent CLI." },
  { id: "oracle", label: "Oracle (sanity check)", note: "Applies the reference solution. Verifies your runner end to end at no API cost.", noModel: true },
];

export interface ModelPreset { id: string; label: string; paper?: boolean }

export const MODEL_PRESETS: ModelPreset[] = [
  { id: "openrouter/z-ai/glm-5.3", label: "GLM-5.3", paper: true },
  { id: "openai/gpt-5.6-sol", label: "GPT-5.6-Sol", paper: true },
  { id: "openrouter/deepseek/deepseek-v4-pro", label: "DeepSeek-V4 Pro", paper: true },
  { id: "openrouter/moonshotai/kimi-k3", label: "Kimi K3", paper: true },
  { id: "anthropic/claude-opus-4-8", label: "Opus 4.8", paper: true },
  { id: "openrouter/minimax/minimax-m3", label: "MiniMax-M3", paper: true },
  { id: "openrouter/qwen/qwen3.7-flash", label: "Qwen3.7-Flash", paper: true },
  { id: "openai/gpt-5.4-mini", label: "GPT-5.4-mini", paper: true },
  { id: "openrouter/mistralai/mistral-small-2603", label: "Mistral Small 4", paper: true },
];

/* ---------------- Result shapes written by the runner ---------------- */

export interface Attempt {
  reward: number;
  score: number;
  exception: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_sec: number | null;
  cost_usd: number | null;
  tokens: { input: number; cached: number; output: number } | null;
  patch: string;
  verifier_tail: string;
  agent_tail: string;
}
export interface TaskResult { task_id: string; agent: string; model: string; attempts: Attempt[]; best_score: number; passed: boolean }
export interface RunSummary {
  request_id: string;
  run_id: number;
  run_url: string;
  agent: string;
  model: string;
  status: "completed" | "partial" | "cancelled" | "failed" | string;
  error?: string;
  started_at?: string;
  finished_at: string;
  n_tasks: number;
  n_passed: number;
  pass_rate: number;
  mean_score: number;
  total_cost_usd: number | null;
  tasks: { task_id: string; passed: boolean; best_score: number; exception: string | null; file?: string }[];
}
export interface StageState { key: string; label: string; state: "pending" | "running" | "done" | "failed" }
export interface GenProgress {
  request_id: string;
  run_id: number;
  run_url: string;
  updated_at: string;
  status: "running" | "passed" | "failed";
  stages: StageState[];
  log_tail: string;
  requester?: string;
  note?: string;
}

export const GEN_STAGES: { key: string; label: string; blurb: string }[] = [
  { key: "research", label: "Online Security Researcher", blurb: "Consults authoritative sources and distills a CWE security profile." },
  { key: "architect", label: "Task Architect", blurb: "Turns the profile and spec into a repository-scale blueprint." },
  { key: "strategist", label: "Exploit Test Strategist", blurb: "Plans exploit tests per attack path and functional checks." },
  { key: "engineer", label: "Repository Engineer", blurb: "Builds the application, the secure reference, and seeds the vulnerabilities." },
  { key: "reviewer", label: "Security Reviewer", blurb: "Independently audits the task and routes revisions." },
  { key: "validation", label: "Deterministic validation", blurb: "Release gates: tests, mutants, score bounds." },
  { key: "release", label: "Harbor release gate", blurb: "Oracle run in a clean Linux container." },
];

/* ---------------- Dispatch helpers ---------------- */

export interface EvalRequest {
  tasks: string[];
  agent: string;
  model: string;
  agentKwargs: Record<string, string | number | boolean>;
  nAttempts: number;
  maxParallel: number;
}


export async function dispatchEvaluate(gh: GitHub, repo: string, r: EvalRequest): Promise<string> {
  const rid = requestId("ev");
  await gh.dispatch(repo, "evaluate.yml", {
    request_id: rid,
    tasks: r.tasks.join(","),
    agent: r.agent,
    model: r.model,
    agent_kwargs: JSON.stringify(r.agentKwargs),
    n_attempts: String(r.nAttempts),
    max_parallel: String(r.maxParallel),
    dataset: CONFIG.hfDataset,
    generated_repo: CONFIG.generatedRepo,
  });
  rememberRequest(repo, { rid, kind: "evaluate", created_at: new Date().toISOString(), label: `${r.agent} · ${r.model}`, n: r.tasks.length });
  return rid;
}

/** Workflow runs carry the request id in their run-name. */
export async function findRun(gh: GitHub, repo: string, rid: string): Promise<GhRun | null> {
  const runs = await gh.runs(repo, "evaluate.yml", 50);
  return runs.find((r) => r.display_title.includes(rid) || r.name.includes(rid)) ?? null;
}

/* ---------------- Local request history (per browser) ---------------- */

export interface RequestRecord { rid: string; kind: "evaluate" | "generate"; created_at: string; label: string; n: number }
const HIST_KEY = (repo: string) => `secprobe.history.${repo}`;

export function rememberRequest(repo: string, rec: RequestRecord) {
  try {
    const list = history(repo).filter((r) => r.rid !== rec.rid);
    list.unshift(rec);
    localStorage.setItem(HIST_KEY(repo), JSON.stringify(list.slice(0, 200)));
  } catch { /* storage unavailable: history is a convenience only */ }
}

export function history(repo: string): RequestRecord[] {
  try { return JSON.parse(localStorage.getItem(HIST_KEY(repo)) || "[]"); } catch { return []; }
}

/** Difficulty presets — mirror runner-template/scripts/plan_matrix.py PRESETS (the runner applies them). */
export const DIFFICULTY_PRESETS: Record<"easy" | "medium" | "hard", Record<string, number>> = {
  easy: {
    min_reference_source_lines: 300, min_implementation_files: 6, min_implementation_functions: 24,
    min_architecture_components: 4, min_architecture_dependencies: 4, min_public_api_symbols: 6,
    min_seeded_vulnerabilities: 1, min_attack_paths_per_vulnerability: 1, min_mutations: 3, max_mutations: 4,
    min_public_tests: 10, min_hidden_tests: 24, min_adversarial_families: 5,
  },
  medium: {
    min_reference_source_lines: 600, min_implementation_files: 10, min_implementation_functions: 48,
    min_architecture_components: 6, min_architecture_dependencies: 7, min_public_api_symbols: 8,
    min_seeded_vulnerabilities: 2, min_attack_paths_per_vulnerability: 2, min_mutations: 3, max_mutations: 5,
    min_public_tests: 14, min_hidden_tests: 40, min_adversarial_families: 7,
  },
  hard: {
    min_reference_source_lines: 1000, min_implementation_files: 14, min_implementation_functions: 72,
    min_architecture_components: 8, min_architecture_dependencies: 10, min_public_api_symbols: 12,
    min_seeded_vulnerabilities: 3, min_attack_paths_per_vulnerability: 2, min_mutations: 4, max_mutations: 6,
    min_public_tests: 20, min_hidden_tests: 64, min_adversarial_families: 10,
  },
};

/** The paper's difficulty-control vector h = (h_repo, h_arch, h_vuln, h_eval). Bounds from SecProbeConfig. */
export const CONTROL_GROUPS: { key: string; symbol: string; label: string; fields: { key: string; label: string; min: number; max: number; step?: number }[] }[] = [
  { key: "repo", symbol: "h_repo", label: "Repository scale", fields: [
    { key: "min_reference_source_lines", label: "Source lines", min: 100, max: 5000, step: 50 },
    { key: "min_implementation_files", label: "Implementation files", min: 3, max: 80 },
    { key: "min_implementation_functions", label: "Functions", min: 12, max: 300 },
  ] },
  { key: "arch", symbol: "h_arch", label: "Architecture", fields: [
    { key: "min_architecture_components", label: "Components", min: 3, max: 40 },
    { key: "min_architecture_dependencies", label: "Dependencies", min: 2, max: 80 },
    { key: "min_public_api_symbols", label: "Public API symbols", min: 4, max: 80 },
  ] },
  { key: "vuln", symbol: "h_vuln", label: "Vulnerability", fields: [
    { key: "min_seeded_vulnerabilities", label: "Seeded vulnerabilities", min: 1, max: 10 },
    { key: "min_attack_paths_per_vulnerability", label: "Attack paths / vuln", min: 1, max: 6 },
    { key: "min_mutations", label: "Security mutations", min: 3, max: 12 },
  ] },
  { key: "eval", symbol: "h_eval", label: "Evaluation", fields: [
    { key: "min_public_tests", label: "Public tests", min: 8, max: 120 },
    { key: "min_hidden_tests", label: "Hidden tests", min: 12, max: 300 },
    { key: "min_adversarial_families", label: "Exploit families", min: 4, max: 40 },
  ] },
];
