import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useParams } from "react-router-dom";
import { useAsync, usePoll } from "../lib/hooks";
import { loadIndex, loadLeaderboard } from "../lib/data";
import { GhJob, GhRun } from "../lib/github";
import { HARNESSES, MODEL_PRESETS, RunSummary, TaskResult, findRun } from "../lib/runner";
import { fmtDuration, timeAgo } from "../lib/format";
import { RunnerCtx, RunnerGate } from "../components/Runner";
import { IconArrowLeft, IconExternal, IconStop, IconX } from "../components/Icons";
import "./console.css";

export default function EvalRun() {
  const { rid = "" } = useParams();
  return (
    <div className="wrap console">
      <Link to="/evaluate" className="back-link" style={{ marginBottom: 24, display: "inline-flex" }}><IconArrowLeft width={14} height={14} /> Evaluate</Link>
      <RunnerGate>{(ctx) => <Monitor ctx={ctx} rid={rid} />}</RunnerGate>
    </div>
  );
}

type TaskState = "queued" | "running" | "passed" | "failed" | "error";

function Monitor({ ctx, rid }: { ctx: RunnerCtx; rid: string }) {
  const [run, setRun] = useState<GhRun | null>(null);
  const [jobs, setJobs] = useState<GhJob[]>([]);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [request, setRequest] = useState<Record<string, string> | null>(null);
  const [results, setResults] = useState<Record<string, TaskResult>>({});
  const [missing, setMissing] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const tried = useRef<Record<string, number>>({});
  const idx = useAsync(loadIndex, []);
  const lb = useAsync(loadLeaderboard, []);
  const titles = useMemo(() => new Map((idx.data?.tasks ?? []).map((t) => [t.id, t.title])), [idx.data]);

  const done = summary != null || (run?.status === "completed" && jobs.every((j) => j.status === "completed"));

  usePoll(async () => {
    const r = run ?? (await findRun(ctx.gh, ctx.repo, rid));
    if (!r) { setMissing((m) => m + 1); return; }
    const fresh = await ctx.gh.run(ctx.repo, r.id);
    setRun(fresh);
    if (!request) setRequest(await ctx.gh.readJson(ctx.repo, `results/${rid}/request.json`));
    // Per-task results appear as each task is graded (runner v2+); fetch the ones we don't have yet.
    const jobList = await ctx.gh.jobs(ctx.repo, r.id);
    setJobs(jobList);
    const graded = jobList.filter((j) => j.name.startsWith("task") && j.status === "completed")
      .map((j) => j.name.replace(/^task\s*·\s*/, ""))
      .filter((id) => !results[id] && Date.now() - (tried.current[id] ?? 0) > 30000);
    graded.forEach((id) => { tried.current[id] = Date.now(); });
    if (graded.length) {
      const got = await Promise.all(graded.map(async (id) => {
        const slug = id.startsWith("generated:") ? `generated-${id.slice(10)}` : id;
        return [id, await ctx.gh.readJson<TaskResult>(ctx.repo, `results/${rid}/tasks/${slug}.json`)] as const;
      }));
      const add = Object.fromEntries(got.filter(([, v]) => v)) as Record<string, TaskResult>;
      if (Object.keys(add).length) setResults((cur) => ({ ...cur, ...add }));
    }
    if (fresh.status === "completed") {
      const s = await ctx.gh.readJson<RunSummary>(ctx.repo, `results/${rid}/summary.json`);
      if (s) {
        setSummary(s);
        const pairs = await Promise.all(s.tasks.map(async (t) => [t.task_id, await ctx.gh.readJson<TaskResult>(ctx.repo, `results/${rid}/${t.file ?? `tasks/${t.task_id}.json`}`)] as const));
        setResults(Object.fromEntries(pairs.filter(([, v]) => v)) as Record<string, TaskResult>);
      }
    }
  }, done ? 600000 : 8000, !summary, [rid]);

  const taskJobs = jobs.filter((j) => j.name.startsWith("task"));
  const tasks: { id: string; state: TaskState; job?: GhJob; step?: string; score?: number; duration?: number | null; cost?: number | null }[] = useMemo(() => {
    const ids = summary?.tasks.map((t) => t.task_id) ?? request?.tasks?.split(",") ?? taskJobs.map((j) => j.name.replace(/^task\s*·\s*/, ""));
    return ids.map((id) => {
      const job = taskJobs.find((j) => j.name.endsWith(id));
      const res = results[id];
      const sum = summary?.tasks.find((t) => t.task_id === id);
      let state: TaskState = "queued";
      if (sum) state = sum.exception && !sum.passed && !sum.best_score ? "error" : sum.passed ? "passed" : "failed";
      else if (res) state = res.passed ? "passed" : res.attempts.every((a) => a.exception && !a.score) ? "error" : "failed";
      else if (job?.status === "in_progress") state = "running";
      else if (job?.status === "completed") state = job.conclusion === "success" ? "running" : "error";
      const graded = job?.status === "completed" && job.conclusion === "success" && !sum;
      const step = graded ? "Graded · publishing" : job?.steps?.find((s) => s.status === "in_progress")?.name;
      const a = res?.attempts?.[0];
      return { id, state, job, step, score: sum?.best_score ?? res?.best_score, duration: a?.duration_sec ?? null, cost: res ? res.attempts.reduce((s, x) => s + (x.cost_usd ?? 0), 0) : null };
    });
  }, [summary, request, taskJobs, results]);

  const n = tasks.length || summary?.n_tasks || 0;
  const passed = tasks.filter((t) => t.state === "passed").length;
  const failed = tasks.filter((t) => t.state === "failed" || t.state === "error").length;
  const running = tasks.filter((t) => t.state === "running").length;
  const agent = summary?.agent ?? request?.agent ?? "";
  const model = summary?.model ?? request?.model ?? "";
  const scores = tasks.filter((t) => t.score != null).map((t) => t.score!);
  const elapsed = run?.run_started_at ? ((summary ? new Date(summary.finished_at) : run.status === "completed" ? new Date(run.updated_at) : new Date()).getTime() - new Date(run.run_started_at).getTime()) / 1000 : null;

  // Paper reference for the same backbone + harness, if any.
  const paper = useMemo(() => {
    if (!lb.data || !model) return null;
    const preset = MODEL_PRESETS.find((m) => m.id === model);
    const row = preset && lb.data.rows.find((r) => r.model === preset.label);
    const h = agent === "terminus-2" ? "terminus" : agent === "mini-swe-agent" ? "mini" : null;
    return row && h ? { model: row.model, pass: row[h].pass, score: row[h].score } : null;
  }, [lb.data, model, agent]);

  if (!run) {
    return (
      <div className="panel" style={{ padding: 32 }}>
        <div className="row"><div className="spinner" /> <b>Waiting for GitHub to start the run…</b></div>
        <p className="muted" style={{ marginBottom: 0 }}>
          Request <span className="mono">{rid}</span>. Workflow runs usually appear within 10–30 seconds.
          {missing > 8 && <> Still nothing? Check <a href={`https://github.com/${ctx.repo}/actions`} target="_blank" rel="noreferrer">your runner's Actions tab</a>; Actions may need to be enabled on first use.</>}
        </p>
      </div>
    );
  }

  const status: TaskState | "cancelled" = summary ? (summary.status === "completed" ? "passed" : "failed") : run.status === "completed" ? (run.conclusion === "cancelled" ? "cancelled" : "failed") : "running";
  const statusLabel = summary
    ? ({ completed: "Completed", partial: "Partially completed", cancelled: "Cancelled", failed: "Failed" } as Record<string, string>)[summary.status] ?? summary.status
    : run.status === "completed" ? (run.conclusion === "cancelled" ? "Cancelled" : "Finished — publishing results") : run.status === "queued" ? "Queued" : "Running";

  return (
    <div className="fade-in">
      <div className="mon-head">
        <div>
          <p className="eyebrow">Evaluation · <span className="mono" style={{ textTransform: "none" }}>{rid}</span></p>
          <h1 className="h1" style={{ fontSize: "clamp(28px, 4vw, 40px)" }}>{HARNESSES.find((h) => h.id === agent)?.label ?? agent} <span className="faint">×</span> <span className="mono" style={{ fontSize: "0.6em" }}>{model}</span></h1>
          <div className="row-wrap" style={{ marginTop: 12 }}>
            <span className={`status-pill st-${status === "passed" ? "passed" : status === "running" ? "running" : "error"}`}>
              {status === "running" && <span className="live-dot" />}
              {statusLabel}
            </span>
            <span className="faint" style={{ fontSize: 13 }}>started {timeAgo(run.run_started_at ?? run.created_at)} · {fmtDuration(elapsed)} elapsed</span>
          </div>
        </div>
        <div className="row-wrap">
          <a className="btn btn-sm" href={run.html_url} target="_blank" rel="noreferrer">GitHub run <IconExternal /></a>
          {run.status !== "completed" && <button className="btn btn-sm btn-ghost" onClick={() => confirm("Cancel this evaluation?") && ctx.gh.cancel(ctx.repo, run.id)}><IconStop /> Cancel</button>}
        </div>
      </div>

      <dl className="mon-stats num">
        <div><dt>Strict pass rate</dt><dd style={{ color: "var(--accent)" }}>{n ? `${((passed / n) * 100).toFixed(1)}%` : "—"}</dd></div>
        <div><dt>Passed</dt><dd>{passed}<span className="faint" style={{ fontSize: 18 }}> / {n}</span></dd></div>
        <div><dt>Mean grader score</dt><dd>{scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "—"}</dd></div>
        <div><dt>In progress</dt><dd>{running}</dd></div>
        <div><dt>API cost</dt><dd>{summary?.total_cost_usd != null ? `$${summary.total_cost_usd.toFixed(2)}` : "—"}</dd></div>
      </dl>

      <div className="progress" style={{ marginBottom: 10 }} aria-label="Progress">
        <span style={{ width: `${(passed / Math.max(n, 1)) * 100}%`, background: "var(--ok)" }} />
        <span style={{ width: `${(failed / Math.max(n, 1)) * 100}%`, background: "var(--vuln)" }} />
        <span style={{ width: `${(running / Math.max(n, 1)) * 100}%`, background: "var(--accent)", opacity: 0.5 }} />
      </div>
      {summary?.error && <div className="alert alert-err" style={{ marginBottom: 16 }}>{summary.error}</div>}
      {paper && (
        <p className="hint" style={{ marginBottom: 24 }}>
          Paper reference for {paper.model} with this harness on all 353 tasks: <b>{paper.pass.toFixed(2)}%</b> strict pass, <b>{paper.score.toFixed(2)}</b> mean score. Small task subsets vary widely.
        </p>
      )}

      <div className="card scroll-x" style={{ marginTop: paper ? 0 : 24 }}>
        <table className="table res-table">
          <thead>
            <tr><th>Task</th><th>Status</th><th>Score</th><th>Duration</th><th>Cost</th></tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id} className={results[t.id] ? "clickable" : ""} onClick={() => results[t.id] && setOpen(t.id)}>
                <td>
                  <div style={{ fontWeight: 500 }}>{titles.get(t.id) ?? t.id}</div>
                  <div className="mono faint" style={{ fontSize: 11.5 }}>{t.id}</div>
                </td>
                <td>
                  <span className={`status-pill st-${t.state}`}>
                    {t.state === "running" && <span className="live-dot" />}
                    {t.state === "running" ? (t.step ? shortStep(t.step) : "Running") : t.state === "queued" ? "Queued" : t.state === "passed" ? "Passed" : t.state === "failed" ? "Not repaired" : "Error"}
                  </span>
                </td>
                <td>
                  {t.score != null ? (
                    <div className="row" style={{ gap: 10 }}>
                      <div className="scorebar"><span style={{ width: `${t.score}%`, background: t.score === 100 ? "var(--ok)" : "var(--vuln)" }} /></div>
                      <span className="num" style={{ fontSize: 13 }}>{t.score.toFixed(1)}</span>
                    </div>
                  ) : <span className="faint">—</span>}
                </td>
                <td className="num muted">{fmtDuration(t.duration ?? (t.job?.started_at && t.job.status === "in_progress" ? (Date.now() - new Date(t.job.started_at).getTime()) / 1000 : null))}</td>
                <td className="num muted">{t.cost ? `$${t.cost.toFixed(2)}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {summary && <p className="hint" style={{ marginTop: 12 }}>Click a task to see the agent's patch, the verifier output and the agent log. Full Harbor job directories are attached to the GitHub run as artifacts for 30 days.</p>}

      {open && results[open] && <ResultDrawer r={results[open]} title={titles.get(open) ?? open} onClose={() => setOpen(null)} />}
    </div>
  );
}

const shortStep = (s: string) => s.replace(/\s*\(.*\)$/, "").slice(0, 32);

function ResultDrawer({ r, title, onClose }: { r: TaskResult; title: string; onClose: () => void }) {
  const [i, setI] = useState(0);
  const a = r.attempts[i];
  return createPortal(
    <>
      <div className="drawer-bg" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={`Result for ${title}`}>
        <div className="drawer-head">
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{title}</div>
            <Link to={`/tasks/${r.task_id}`} className="mono faint" style={{ fontSize: 12 }}>{r.task_id}</Link>
          </div>
          <span className="spacer" />
          {r.attempts.length > 1 && (
            <div className="seg">{r.attempts.map((_, k) => <button key={k} aria-pressed={k === i} onClick={() => setI(k)}>Attempt {k + 1}</button>)}</div>
          )}
          <button className="icon-btn" onClick={onClose} aria-label="Close"><IconX width={18} height={18} /></button>
        </div>
        <div className="drawer-body">
          <dl className="mon-stats num" style={{ gridTemplateColumns: "repeat(4, 1fr)", margin: 0 }}>
            <div><dt>Grader score</dt><dd style={{ color: a.score === 100 ? "var(--ok)" : "var(--vuln)" }}>{a.score.toFixed(1)}</dd></div>
            <div><dt>Duration</dt><dd>{fmtDuration(a.duration_sec)}</dd></div>
            <div><dt>Cost</dt><dd>{a.cost_usd != null ? `$${a.cost_usd.toFixed(2)}` : "—"}</dd></div>
            <div><dt>Tokens in / out</dt><dd style={{ fontSize: 18 }}>{a.tokens ? `${(a.tokens.input / 1000).toFixed(0)}k / ${(a.tokens.output / 1000).toFixed(0)}k` : "—"}</dd></div>
          </dl>
          {a.exception && <div className="alert alert-warn mono" style={{ fontSize: 12 }}>{a.exception}</div>}
          <section>
            <h3 className="h3" style={{ marginBottom: 8 }}>Agent patch</h3>
            {a.patch ? <Diff text={a.patch} /> : <p className="muted">The agent did not change any files.</p>}
          </section>
          <section>
            <h3 className="h3" style={{ marginBottom: 8 }}>Verifier output</h3>
            <pre className="logbox">{a.verifier_tail || "—"}</pre>
          </section>
          <section>
            <h3 className="h3" style={{ marginBottom: 8 }}>Agent log (tail)</h3>
            <pre className="logbox">{a.agent_tail || "—"}</pre>
          </section>
        </div>
      </aside>
    </>,
    document.body,
  );
}

function Diff({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="diff">
      {lines.map((l, k) => {
        const cls = l.startsWith("diff --git") || l.startsWith("+++ ") || l.startsWith("--- ") ? "file" : l.startsWith("@@") ? "hunk" : l.startsWith("+") ? "add" : l.startsWith("-") ? "del" : "";
        return <div key={k} className={cls}>{l || " "}</div>;
      })}
    </div>
  );
}
