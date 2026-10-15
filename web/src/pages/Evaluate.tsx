import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAsync } from "../lib/hooks";
import { CONFIG } from "../lib/config";
import { CATEGORIES, LANGUAGES, TaskSummary, categoryColor, loadIndex } from "../lib/data";
import { useSession } from "../lib/store";
import { HARNESSES, MODEL_PRESETS, PROVIDERS, RequestRecord, RunSummary, dispatchEvaluate, history, providerForModel } from "../lib/runner";
import { RunnerBar, RunnerCtx, RunnerGate } from "../components/Runner";
import { IconArrowRight, IconPlay, IconX } from "../components/Icons";
import { timeAgo } from "../lib/format";
import "./console.css";

// Mean measured USD per task attempt with Mini-SWE-Agent (paper cost analysis); used only for a rough estimate.
const COST_PER_ATTEMPT: Record<string, number> = {
  "openai/gpt-5.6-sol": 0.63, "openai/gpt-5.4-mini": 0.056, "openrouter/z-ai/glm-5.3": 0.62, "openrouter/moonshotai/kimi-k3": 1.66,
  "openrouter/deepseek/deepseek-v4-pro": 0.2, "openrouter/qwen/qwen3.7-flash": 0.26, "anthropic/claude-opus-4-8": 1.14,
  "openrouter/minimax/minimax-m3": 0.36, "openrouter/mistralai/mistral-small-2603": 0.057,
};
const MAX_TASKS = 64;

export default function Evaluate() {
  const { selection } = useSession();
  const [need, setNeed] = useState<string | undefined>();
  return (
    <div className="wrap console">
      <header className="console-head">
        <p className="eyebrow">Evaluate</p>
        <h1 className="h1">Run a coding agent on SecProbe tasks.</h1>
        <p className="lede" style={{ maxWidth: 720, marginTop: 12 }}>
          Choose tasks, a harness and a model. Each task runs in its own container on your GitHub Actions; the hidden verifier grades the patched repository and results stream back here.
        </p>
      </header>
      <RunnerGate need={need}>
        {(ctx) => <EvalConsole ctx={ctx} selection={selection} onNeedKey={setNeed} />}
      </RunnerGate>
    </div>
  );
}

function EvalConsole({ ctx, selection, onNeedKey }: { ctx: RunnerCtx; selection: string[]; onNeedKey: (s: string) => void }) {
  const idx = useAsync(loadIndex, []);
  const { setSelection, toggle } = useSession();
  const nav = useNavigate();
  const [agent, setAgent] = useState("terminus-2");
  const [model, setModel] = useState(MODEL_PRESETS[0].id);
  const [effort, setEffort] = useState("medium");
  const [maxTurns, setMaxTurns] = useState(100);
  const [attempts, setAttempts] = useState(1);
  const [parallel, setParallel] = useState(4);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const byId = useMemo(() => new Map((idx.data?.tasks ?? []).map((t) => [t.id, t])), [idx.data]);
  const harness = HARNESSES.find((h) => h.id === agent)!;
  const provider = harness.noModel ? undefined : providerForModel(model);
  const hasKey = provider ? ctx.secrets.includes(provider.secret) : true;
  const harnessMismatch = harness.providers && provider && !harness.providers.includes(provider.id);
  const cost = COST_PER_ATTEMPT[model];
  const hasHf = ctx.secrets.includes("HF_TOKEN");
  const needsGh = selection.some((id) => id.startsWith("generated:")) && !ctx.secrets.includes("SECPROBE_GITHUB_TOKEN");
  const tooMany = selection.length > MAX_TASKS;

  const preset = (kind: "cat" | "lang" | "rand10" | "rand30") => {
    const all = idx.data?.tasks ?? [];
    const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
    if (kind === "rand10") return setSelection(shuffle(all).slice(0, 10).map((t) => t.id));
    if (kind === "rand30") return setSelection(shuffle(all).slice(0, 30).map((t) => t.id));
    const key = kind === "cat" ? "category" : "language";
    const groups = new Map<string, TaskSummary[]>();
    all.forEach((t) => { const g = groups.get(t[key]) ?? []; g.push(t); groups.set(t[key], g); });
    setSelection([...groups.values()].map((g) => shuffle(g)[0].id));
  };

  const launch = async () => {
    setBusy(true); setErr(null);
    try {
      const kw: Record<string, string | number | boolean> = {};
      if (agent === "terminus-2" || agent === "mini-swe-agent") {
        if (effort !== "default") kw.reasoning_effort = effort;
        kw.max_turns = maxTurns;
      }
      const rid = await dispatchEvaluate(ctx.gh, ctx.repo, { tasks: selection, agent, model: harness.noModel ? "" : model, agentKwargs: kw, nAttempts: attempts, maxParallel: parallel });
      nav(`/evaluate/${rid}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  return (
    <div className="stack" style={{ gap: 28 }}>
      <RunnerBar ctx={ctx} />
      {needsGh && (
        <div className="alert alert-warn row-wrap">
          <span>Your selection includes generated tasks, which live in the private repository <span className="mono">{CONFIG.generatedRepo}</span>. Add a fine-grained GitHub token with read access (Contents: read) to it.</span>
          <span className="spacer" />
          <button className="btn btn-sm" onClick={() => onNeedKey("SECPROBE_GITHUB_TOKEN")}>Add token</button>
        </div>
      )}
      {!hasHf && (
        <div className="alert alert-warn row-wrap">
          <span>
            Task bundles live in the gated Hugging Face dataset <span className="mono">{CONFIG.hfDataset}</span>.{" "}
            <a href={`https://huggingface.co/datasets/${CONFIG.hfDataset}`} target="_blank" rel="noreferrer">Request access</a> with your Hugging Face account
            (the authors approve requests manually), then add a Hugging Face <b>read</b> token from that account so your runner can download them.
          </span>
          <span className="spacer" />
          <button className="btn btn-sm" onClick={() => onNeedKey("HF_TOKEN")}>Add token</button>
        </div>
      )}
      <div className="console-grid">
        <div className="stack" style={{ gap: 28 }}>
          {/* Tasks */}
          <section className="cfg">
            <div className="cfg-head">
              <span className="cfg-n">1</span>
              <h2 className="h3">Tasks</h2>
              <span className="faint num" style={{ fontSize: 13 }}>{selection.length} selected · max {MAX_TASKS} per run</span>
              <span className="spacer" />
              {selection.length > 0 && <button className="btn btn-sm btn-ghost" onClick={() => setSelection([])}>Clear</button>}
            </div>
            <div className="row-wrap" style={{ marginBottom: 14 }}>
              <Link to="/tasks" className="btn btn-sm">Pick in explorer <IconArrowRight /></Link>
              <button className="btn btn-sm btn-ghost" onClick={() => preset("cat")}>One per category ({CATEGORIES.length})</button>
              <button className="btn btn-sm btn-ghost" onClick={() => preset("lang")}>One per language</button>
              <button className="btn btn-sm btn-ghost" onClick={() => preset("rand10")}>Random 10</button>
              <button className="btn btn-sm btn-ghost" onClick={() => preset("rand30")}>Random 30</button>
            </div>
            {selection.length === 0 ? (
              <div className="empty-box">No tasks yet. Pick some in the explorer or use a preset above.</div>
            ) : (
              <ul className="sel-list">
                {selection.map((id) => {
                  const t = byId.get(id);
                  return (
                    <li key={id}>
                      <span className="task-cat" style={{ background: t ? categoryColor(t.category) : "var(--line-strong)" }} />
                      <Link to={id.startsWith("generated:") ? `/generate/${id.slice(10)}` : `/tasks/${id}`} className="sel-title">{t?.title ?? id}</Link>
                      <span className="chip chip-mono" style={{ height: 20 }}>{t?.cwe ?? "generated"}</span>
                      {t && <span className="faint" style={{ fontSize: 12 }}>{LANGUAGES[t.language]?.label}</span>}
                      <span className="spacer" />
                      <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => toggle(id)} aria-label={`Remove ${id}`}><IconX width={13} height={13} /></button>
                    </li>
                  );
                })}
              </ul>
            )}
            {tooMany && <div className="alert alert-warn" style={{ marginTop: 10 }}>A single run takes at most {MAX_TASKS} tasks. Remove {selection.length - MAX_TASKS} or split into several runs.</div>}
          </section>

          {/* Harness */}
          <section className="cfg">
            <div className="cfg-head"><span className="cfg-n">2</span><h2 className="h3">Agent harness</h2></div>
            <div className="harness-grid">
              {HARNESSES.map((h) => (
                <button key={h.id} className={`harness ${agent === h.id ? "on" : ""}`} onClick={() => setAgent(h.id)} aria-pressed={agent === h.id}>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="harness-name">{h.label}</span>
                    {h.paper && <span className="chip chip-accent" style={{ height: 18, fontSize: 10.5 }}>paper</span>}
                  </div>
                  <span className="harness-note">{h.note}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Model */}
          {!harness.noModel && <section className="cfg">
            <div className="cfg-head"><span className="cfg-n">3</span><h2 className="h3">Model</h2></div>
            <div className="model-presets">
              {MODEL_PRESETS.map((m) => (
                <button key={m.id} className={`chip ${model === m.id ? "chip-accent" : ""}`} style={{ cursor: "pointer", height: 28 }} onClick={() => setModel(m.id)}>{m.label}</button>
              ))}
            </div>
            <div className="field" style={{ marginTop: 14 }}>
              <label htmlFor="model">Model id <span className="faint" style={{ fontWeight: 400 }}>· LiteLLM format <span className="mono">provider/model</span></span></label>
              <input id="model" className="input mono" value={model} onChange={(e) => setModel(e.target.value.trim())} spellCheck={false} />
              <div className="hint">
                {provider ? <>Uses <span className="mono">{provider.secret}</span> from your runner.</> : <>Unknown provider prefix. Supported: {PROVIDERS.map((p) => p.prefix).join(" ")}</>}
              </div>
            </div>
            {!hasKey && provider && (
              <div className="alert alert-warn row" style={{ marginTop: 12 }}>
                <span>No {provider.label} key in your runner yet.</span><span className="spacer" />
                <button className="btn btn-sm" onClick={() => onNeedKey(provider.secret)}>Add key</button>
              </div>
            )}
            {harnessMismatch && <div className="alert alert-warn" style={{ marginTop: 12 }}>{harness.label} normally talks to {harness.providers!.join(", ")} directly; other providers may not work.</div>}
          </section>}

          {/* Settings */}
          <section className="cfg">
            <div className="cfg-head"><span className="cfg-n">4</span><h2 className="h3">Settings</h2></div>
            <div className="settings-grid">
              {(agent === "terminus-2" || agent === "mini-swe-agent") && (
                <>
                  <div className="field">
                    <label>Reasoning effort</label>
                    <select className="select" value={effort} onChange={(e) => setEffort(e.target.value)}>
                      {["default", "none", "low", "medium", "high"].map((x) => <option key={x}>{x}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>Max agent turns</label>
                    <input className="input num" type="number" min={10} max={400} value={maxTurns} onChange={(e) => setMaxTurns(Math.max(10, Math.min(400, +e.target.value || 100)))} />
                  </div>
                </>
              )}
              <div className="field">
                <label>Attempts per task</label>
                <select className="select" value={attempts} onChange={(e) => setAttempts(+e.target.value)}>
                  {[1, 2, 3, 4, 5].map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Parallel tasks</label>
                <select className="select" value={parallel} onChange={(e) => setParallel(+e.target.value)}>
                  {[1, 2, 4, 6, 8, 12, 16, 20].map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
            </div>
          </section>
        </div>

        {/* Summary */}
        <aside className="summary">
          <div className="summary-card">
            <div className="eyebrow" style={{ marginBottom: 12 }}>Run summary</div>
            <dl className="summary-kv">
              <div><dt>Tasks</dt><dd className="num">{selection.length}{attempts > 1 ? ` × ${attempts}` : ""}</dd></div>
              <div><dt>Harness</dt><dd>{harness.label}</dd></div>
              <div><dt>Model</dt><dd className="mono" style={{ fontSize: 12.5, wordBreak: "break-all" }}>{harness.noModel ? "—" : model}</dd></div>
              <div><dt>Wall time</dt><dd>≈ {Math.max(1, Math.ceil(selection.length / parallel)) * 30}–{Math.max(1, Math.ceil(selection.length / parallel)) * 120} min</dd></div>
              <div><dt>Est. API cost</dt><dd className="num">{harness.noModel ? "$0" : cost ? `≈ $${(cost * selection.length * attempts).toFixed(2)}` : "depends on model"}</dd></div>
            </dl>
            <p className="hint" style={{ margin: "12px 0 16px" }}>
              Cost is billed by your provider. The estimate uses the paper's measured mean cost per attempt for this model{cost ? "" : " (not available for custom models)"}.
            </p>
            {err && <div className="alert alert-err" style={{ marginBottom: 12 }}>{err}</div>}
            <button className="btn btn-accent" style={{ width: "100%", justifyContent: "center", height: 44 }}
              disabled={busy || !selection.length || tooMany || !hasKey || !hasHf || needsGh || (!model && !harness.noModel)}
              onClick={launch}>
              {busy ? <div className="spinner" /> : <><IconPlay /> Launch evaluation</>}
            </button>
          </div>
        </aside>
      </div>

      <RecentRuns ctx={ctx} kind="evaluate" />
    </div>
  );
}

export function RecentRuns({ ctx, kind }: { ctx: RunnerCtx; kind: "evaluate" | "generate" }) {
  const [remote, setRemote] = useState<RunSummary[] | null>(null);
  const local = history(ctx.repo).filter((r) => r.kind === kind);
  useEffect(() => {
    if (kind !== "evaluate") return;
    ctx.gh.readJson<RunSummary[]>(ctx.repo, "results/index.json").then(setRemote).catch(() => setRemote([]));
  }, [ctx, kind]);

  const rows: (RequestRecord & { summary?: RunSummary })[] = [...local];
  (remote ?? []).forEach((s) => {
    const hit = rows.find((r) => r.rid === s.request_id);
    if (hit) hit.summary = s;
    else rows.push({ rid: s.request_id, kind: "evaluate", created_at: s.finished_at, label: `${s.agent} · ${s.model}`, n: s.n_tasks, summary: s });
  });
  if (!rows.length) return null;
  return (
    <section>
      <div className="row" style={{ marginBottom: 10 }}><h2 className="h3">Your {kind === "evaluate" ? "evaluations" : "generations"}</h2></div>
      <div className="card">
        <table className="table">
          <tbody>
            {rows.slice(0, 20).map((r) => (
              <tr key={r.rid}>
                <td><Link to={`/${kind}/${r.rid}`} className="mono" style={{ fontSize: 12.5 }}>{r.rid}</Link></td>
                <td>{r.label}</td>
                <td className="num muted">{r.n} task{r.n === 1 ? "" : "s"}</td>
                <td className="num">{r.summary ? <><b>{r.summary.n_passed}</b>/{r.summary.n_tasks} passed · {r.summary.mean_score.toFixed(1)} mean</> : <span className="faint">open to see status</span>}</td>
                <td className="faint" style={{ fontSize: 12.5, textAlign: "right" }}>{timeAgo(r.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
