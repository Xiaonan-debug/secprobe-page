import { ReactNode, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAsync } from "../lib/hooks";
import { LANGUAGES, LEVELS, TaskDetail, TaskSummary, categoryColor, loadIndex, loadTask } from "../lib/data";
import { hfFileUrl } from "../lib/config";
import { useSession } from "../lib/store";
import { renderMarkdown } from "../lib/markdown";
import { CodeViewer, pickDefaultFile } from "../components/CodeViewer";
import { AnalysisPanel } from "../components/AnalysisPanel";
import { loadTaskAnalysis } from "../lib/analysis";
import { IconArrowLeft, IconCheck, IconCopy, IconDownload, IconPlay, IconPlus } from "../components/Icons";
import "./taskpage.css";

export default function TaskPage() {
  const { id = "" } = useParams();
  const idx = useAsync(loadIndex, []);
  const detail = useAsync(() => loadTask(id), [id]);
  const summary = idx.data?.tasks.find((t) => t.id === id);

  if (detail.error) {
    return (
      <div className="wrap" style={{ padding: "80px 0" }}>
        <p className="eyebrow">Task not found</p>
        <h1 className="h1">No task called “{id}”.</h1>
        <p><Link to="/tasks">Back to all tasks</Link></p>
      </div>
    );
  }
  if (!detail.data) return <div className="wrap" style={{ padding: "80px 0" }}><div className="spinner" /></div>;

  // Neighbours for keyboard-free prev/next browsing in the current default order.
  const list = idx.data?.tasks ?? [];
  const i = list.findIndex((t) => t.id === id);
  const prev = i > 0 ? list[i - 1] : undefined;
  const next = i >= 0 && i < list.length - 1 ? list[i + 1] : undefined;

  return (
    <TaskView
      detail={detail.data}
      summary={summary}
      back={<Link to="/tasks" className="back-link"><IconArrowLeft width={14} height={14} /> All tasks</Link>}
      pager={
        <div className="row" style={{ gap: 6 }}>
          {prev && <Link className="btn btn-sm btn-ghost" to={`/tasks/${prev.id}`} title={prev.title}>← Prev</Link>}
          {next && <Link className="btn btn-sm btn-ghost" to={`/tasks/${next.id}`} title={next.title}>Next →</Link>}
        </div>
      }
      bundleUrl={summary ? hfFileUrl(summary.bundle) : undefined}
      evaluable
    />
  );
}

type Tab = "code" | "analysis" | "instruction" | "run";

export function TaskView({ detail, summary, back, pager, bundleUrl, evaluable, evalRef, extraActions }: {
  detail: TaskDetail;
  summary?: Partial<TaskSummary>;
  back?: ReactNode;
  pager?: ReactNode;
  bundleUrl?: string;
  evaluable?: boolean;
  /** Task reference passed to the runner (defaults to the task id). */
  evalRef?: string;
  extraActions?: ReactNode;
}) {
  const [params, setParams] = useSearchParams();
  const { selection, toggle, setSelection } = useSession();
  const nav = useNavigate();
  const tab = (params.get("tab") as Tab) || "code";
  const defaultFile = useMemo(() => pickDefaultFile(detail.tree), [detail.tree]);
  const file = params.get("file") ?? defaultFile;
  const line = params.get("L") ? Number(params.get("L")) : undefined;
  const ref = evalRef ?? detail.id;
  const selected = selection.includes(ref);
  const s = { ...detail.summary, ...summary };
  const analysis = useAsync(() => (evalRef?.startsWith("generated:") ? Promise.resolve(null) : loadTaskAnalysis(detail.id)), [detail.id]);
  const [annotate, setAnnotate] = useState(true);

  const setParam = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v == null ? p.delete(k) : p.set(k, v)));
    setParams(p, { replace: true });
  };

  return (
    <div className="taskpage">
      <div className="wrap">
        <div className="tp-top">
          {back}
          <span className="spacer" />
          {pager}
        </div>

        <header className="tp-head">
          <div className="tp-chips">
            {s.category && <span className="chip"><span className="dot" style={{ background: categoryColor(s.category) }} />{s.category}</span>}
            <span className="chip chip-mono">{detail.cwe}</span>
            <span className="chip"><span className="dot" style={{ background: LANGUAGES[detail.language]?.color }} />{LANGUAGES[detail.language]?.label ?? detail.language}</span>
            <span className="chip">{LEVELS[detail.level]?.label ?? detail.level}</span>
          </div>
          <h1 className="h1 tp-title">{detail.title}</h1>
          {detail.subtitle && <p className="tp-subtitle">{detail.subtitle}</p>}
          {s.cwe_name && <p className="muted" style={{ margin: "6px 0 0", fontSize: 14 }}>{detail.cwe} · {s.cwe_name}</p>}

          <dl className="tp-stats num">
            {s.loc != null && <div><dt>Implementation LOC</dt><dd>{s.loc.toLocaleString()}</dd></div>}
            {s.files != null && <div><dt>Implementation files</dt><dd>{s.files}</dd></div>}
            {s.test_files != null && <div><dt>Public test files</dt><dd>{s.test_files}</dd></div>}
            {s.vulns != null && <div><dt>Seeded vulnerabilities</dt><dd>{s.vulns}</dd></div>}
            {s.attack_paths != null && <div><dt>Attack paths</dt><dd>{s.attack_paths}</dd></div>}
            {s.seed_score != null && <div><dt>Seed grader score</dt><dd className="vuln">{s.seed_score.toFixed(1)}<span className="faint"> / 100</span></dd></div>}
          </dl>

          <div className="row-wrap tp-actions">
            {evaluable && (
              <>
                <button className="btn btn-accent" onClick={() => { if (!selected) setSelection([...selection, ref]); nav("/evaluate"); }}>
                  <IconPlay /> Evaluate an agent on this task
                </button>
                <button className="btn" onClick={() => toggle(ref)}>
                  {selected ? <><IconCheck /> In evaluation set</> : <><IconPlus /> Add to evaluation set</>}
                </button>
              </>
            )}
            {bundleUrl && <a className="btn btn-ghost" href={bundleUrl} title="Requires a Hugging Face account with access to the private dataset"><IconDownload /> Harbor bundle</a>}
            {extraActions}
          </div>
        </header>

        <div className="tp-tabs" role="tablist">
          {(["code", "analysis", "instruction", "run"] as Tab[]).filter((t) => t !== "analysis" || analysis.data).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setParam({ tab: t === "code" ? undefined : t })}>
              {t === "code" ? "Repository" : t === "analysis" ? <>Static analysis <span className="tab-count num">{analysis.data?.findings.length}</span></> : t === "instruction" ? "Agent instruction" : "Run locally"}
            </button>
          ))}
        </div>
      </div>

      <div className="wrap tp-body">
        {tab === "code" && (
          <>
            {analysis.data && (
              <label className="row hint" style={{ gap: 8, marginBottom: 10 }}>
                <input type="checkbox" checked={annotate} onChange={(e) => setAnnotate(e.target.checked)} />
                Annotate with static-analysis findings ({analysis.data.findings.length} from {analysis.data.tools.filter((t) => t.status === "ok" && t.id !== "lizard").length} tools)
              </label>
            )}
            <CodeViewer
              entries={detail.tree}
              file={file}
              onFile={(f) => setParam({ file: f, L: undefined })}
              line={line}
              onLine={(n) => setParam({ L: n ? String(n) : undefined })}
              findings={annotate ? analysis.data?.findings : undefined}
            />
          </>
        )}
        {tab === "analysis" && analysis.data && (
          <AnalysisPanel a={analysis.data} onOpen={(path, ln) => setParam({ tab: undefined, file: path, L: ln ? String(ln) : undefined })} />
        )}
        {tab === "instruction" && (
          <div className="tp-instr">
            <div className="tp-note">This is the exact prompt the agent receives inside the container at <code>/app</code>. Exploit tests, vulnerability locations and the reference patch are withheld.</div>
            <div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(detail.instruction_md) }} />
          </div>
        )}
        {tab === "run" && <RunLocally detail={detail} bundleUrl={bundleUrl} />}
      </div>
    </div>
  );
}

function RunLocally({ detail, bundleUrl }: { detail: TaskDetail; bundleUrl?: string }) {
  const cmd = `# 1. Get the Harbor task bundle
curl -L -o ${detail.id}.tar.gz ${bundleUrl ?? "<bundle-url>"}
tar -xzf ${detail.id}.tar.gz

# 2. Sanity check: the reference solution must score 100
pip install harbor==0.20.0
harbor run -p ${detail.id} -a oracle

# 3. Evaluate an agent (needs Docker and the provider's API key)
export OPENROUTER_API_KEY=...
harbor run -p ${detail.id} -a terminus-2 -m openrouter/z-ai/glm-5.3`;
  return (
    <div className="tp-run">
      <div className="tp-run-grid">
        <div>
          <h3 className="h2" style={{ fontSize: 24 }}>Run it yourself</h3>
          <p className="muted">Every task is a self-contained <a href="https://github.com/laude-institute/harbor" target="_blank" rel="noreferrer">Harbor</a> task: a Dockerfile, the agent instruction, a hidden verifier and an oracle solution.</p>
          <dl className="tp-kv">
            <div><dt>Build</dt><dd className="mono">{detail.build_cmd || "—"}</dd></div>
            <div><dt>Public tests</dt><dd className="mono">{detail.test_cmd || "—"}</dd></div>
            <div><dt>Agent time limit</dt><dd>{detail.limits.agent_timeout_sec ? `${Math.round(detail.limits.agent_timeout_sec / 60)} min` : "—"}</dd></div>
            <div><dt>Resources</dt><dd>{detail.limits.cpus ?? "—"} CPU · {detail.limits.memory_mb ? `${detail.limits.memory_mb / 1024} GB` : "—"}</dd></div>
            <div><dt>Pass criterion</dt><dd>Grader score = 100 (T<sub>func</sub> = 1 and T<sub>sec</sub> = 1)</dd></div>
          </dl>
        </div>
        <CopyBlock text={cmd} />
      </div>
    </div>
  );
}

export function CopyBlock({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="copyblock">
      <pre>{text}</pre>
      <button className="btn btn-sm" onClick={() => navigator.clipboard?.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1200); })}>
        {ok ? <><IconCheck /> Copied</> : <><IconCopy /> Copy</>}
      </button>
    </div>
  );
}
