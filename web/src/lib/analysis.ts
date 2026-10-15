import { loadContent } from "./content";
// Precomputed static-analysis layer (CONTRACT.md §7).

export type Severity = "error" | "warning" | "note";

export interface ToolRun { id: string; label: string; version: string; status: "ok" | "skipped" | "failed"; note: string }
export interface Finding {
  tool: string;
  rule: string;
  title: string;
  severity: Severity;
  cwe: string[];
  path: string;
  line: number;
  end_line: number;
  message: string;
  help_url: string | null;
}
export interface FileMetric { path: string; nloc: number; functions: number; avg_ccn: number; max_ccn: number; findings: number }
export interface FnMetric { path: string; name: string; line: number; nloc: number; ccn: number; params: number }
export interface GraphNode { id: string; kind: "source" | "test"; nloc: number; max_ccn: number; findings: number }
export interface TaskAnalysis {
  id: string;
  generated_at: string;
  tools: ToolRun[];
  findings: Finding[];
  metrics: { files: FileMetric[]; functions: FnMetric[] };
  graph: { nodes: GraphNode[]; edges: { source: string; target: string }[] };
}

export interface Rate { tasks: number; detected: number; detected_cwe_match?: number }
export interface AnalysisSummary {
  generated_at: string;
  tools: { id: string; label: string; version: string; languages: string[] }[];
  coverage: Record<string, Record<string, { tasks: number; ok: number; failed: number }>>;
  detection: {
    by_tool: Record<string, Rate>;
    by_tool_category: Record<string, Record<string, Rate>>;
    by_tool_language: Record<string, Record<string, Rate>>;
  };
  noise: Record<string, { findings: number; per_kloc: number; attributable: number; attributable_share: number }>;
  complexity: { max_ccn_hist: [number, number, number][]; nloc_hist: [number, number, number][] };
  method: string;
}

/** Resolves to null when the analysis has not been published yet. */
const load = <T,>(path: string) => loadContent<T>(`analysis/${path}`, true);

export const loadTaskAnalysis = (id: string) => load<TaskAnalysis>(`${id}.json`);
export const loadAnalysisSummary = () => load<AnalysisSummary>("summary.json");

export const TOOL_LABELS: Record<string, string> = {
  codeql: "CodeQL", semgrep: "Semgrep", bandit: "Bandit", gosec: "gosec", cppcheck: "cppcheck",
  flawfinder: "Flawfinder", spotbugs: "SpotBugs + FindSecBugs", eslint: "ESLint security", clippy: "Clippy",
  lizard: "lizard", union: "Any tool (union)", union_no_codeql: "Any tool except CodeQL",
};
export const toolLabel = (id: string) => TOOL_LABELS[id] ?? id;

export const SEVERITY: Record<Severity, { label: string; color: string; rank: number }> = {
  error: { label: "Error", color: "var(--st-critical)", rank: 0 },
  warning: { label: "Warning", color: "var(--st-serious)", rank: 1 },
  note: { label: "Note", color: "var(--faint)", rank: 2 },
};

/** Sequential ramp step for a value in [0, 1]. */
export function seq(t: number): string {
  const steps = ["--seq-100", "--seq-200", "--seq-300", "--seq-400", "--seq-500", "--seq-600", "--seq-700"];
  const i = Math.max(0, Math.min(steps.length - 1, Math.round(t * (steps.length - 1))));
  return `var(${steps[i]})`;
}

/** Text color that stays legible on seq(t), in both themes (the ramp itself is not themed). */
export function seqInk(t: number): string {
  return Math.round(Math.max(0, Math.min(1, t)) * 6) >= 4 ? "#ffffff" : "#0b0b0b";
}

export const pct = (r?: Rate, key: "detected" | "detected_cwe_match" = "detected") =>
  r && r.tasks ? ((r[key] ?? 0) / r.tasks) * 100 : 0;
