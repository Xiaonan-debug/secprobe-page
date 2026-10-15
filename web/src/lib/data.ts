import { loadContent } from "./content";
// Static benchmark data shipped with the site (see CONTRACT.md §1).

export type Language = "python" | "go" | "cpp" | "typescript" | "java" | "rust";
export type Level = "library_component" | "single_process_application" | "multi_service_application";
export type Category = "Injection" | "Access" | "Memory" | "Crypto" | "Filesystem" | "Exposure" | "Concurrency";

export interface TaskSummary {
  id: string;
  title: string;
  subtitle: string;
  summary: string;
  cwe: string;
  cwe_name: string;
  category: Category;
  language: Language;
  level: Level;
  loc: number;
  files: number;
  test_files: number;
  vulns: number;
  attack_paths: number;
  seed_score: number;
  bundle: string;
  bundle_bytes: number;
  data_bytes: number;
}

export interface TreeEntry {
  path: string;
  size: number;
  lang: string;
  kind: "source" | "test" | "doc" | "config" | "other";
  content: string | null;
  omitted: null | "binary" | "too_large" | "build_output";
}

export interface TaskDetail {
  id: string;
  title: string;
  subtitle: string;
  cwe: string;
  language: Language;
  level: Level;
  instruction_md: string;
  build_cmd: string;
  test_cmd: string;
  limits: { agent_timeout_sec?: number; cpus?: number; memory_mb?: number };
  tree: TreeEntry[];
  summary?: Partial<TaskSummary>;
}

export interface Index {
  generated_at: string;
  counts: {
    tasks: number;
    cwes: number;
    languages: Record<string, number>;
    categories: Record<string, number>;
    levels: Record<string, number>;
  };
  tasks: TaskSummary[];
}

export interface HarnessResult { pass: number; score: number; solved: number }
export interface LeaderRow {
  model: string;
  provider: string;
  open_weights: boolean;
  mini: HarnessResult;
  terminus: HarnessResult;
}
export interface Leaderboard { source: string; harnesses: string[]; rows: LeaderRow[] }
export interface CweEntry { id: string; name: string; category: Category; tasks: number }

const load = <T,>(path: string) => loadContent<T>(path) as Promise<T>;

export const loadIndex = () => load<Index>("index.json");
export const loadTask = (id: string) => load<TaskDetail>(`tasks/${id}.json`);
export const loadLeaderboard = () => load<Leaderboard>("leaderboard.json");
export const loadCwes = () => load<CweEntry[]>("cwes.json");

export const LANGUAGES: Record<Language, { label: string; color: string }> = {
  python: { label: "Python", color: "var(--faint)" },
  go: { label: "Go", color: "var(--faint)" },
  cpp: { label: "C++", color: "var(--faint)" },
  typescript: { label: "TypeScript", color: "var(--faint)" },
  java: { label: "Java", color: "var(--faint)" },
  rust: { label: "Rust", color: "var(--faint)" },
};

export const LEVELS: Record<Level, { label: string; short: string }> = {
  library_component: { label: "Library component", short: "Library" },
  single_process_application: { label: "Single-process application", short: "Single-process" },
  multi_service_application: { label: "Multi-service application", short: "Multi-service" },
};

export const CATEGORIES: Category[] = ["Injection", "Access", "Memory", "Crypto", "Filesystem", "Exposure", "Concurrency"];
export const categoryColor = (c: string) => `var(--cat-${c.toLowerCase()})`;
