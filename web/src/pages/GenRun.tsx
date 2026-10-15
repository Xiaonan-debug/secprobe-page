import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { usePoll } from "../lib/hooks";
import { GEN_STAGES, GenProgress } from "../lib/runner";
import { TaskDetail } from "../lib/data";
import { CONFIG } from "../lib/config";
import { useSession } from "../lib/store";
import { HostedStatus, generatedProgress, generatedTask, hostedCancel, hostedStatus } from "../lib/hosted";
import { timeAgo } from "../lib/format";
import { IconArrowLeft, IconCheck, IconCopy, IconDownload, IconExternal, IconStop, IconX } from "../components/Icons";
import { TaskView } from "./TaskPage";
import "./console.css";

// Public, shareable view of one hosted generation: live stages while running, the task once released.
export default function GenRun() {
  const { rid = "" } = useParams();
  const { gh, token, user } = useSession();
  const [status, setStatus] = useState<HostedStatus | null>(null);
  const [progress, setProgress] = useState<GenProgress | null>(null);
  const [task, setTask] = useState<(TaskDetail & { summary?: Record<string, unknown> }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const terminal = task != null || progress?.status === "failed" || (status?.status === "completed" && progress?.status !== "running" && progress != null);

  usePoll(async () => {
    try {
      const [st, p] = await Promise.all([hostedStatus(rid).catch(() => null), generatedProgress(gh, rid)]);
      if (st) setStatus(st);
      if (p) setProgress(p);
      if (p?.status === "passed" || st?.status === "completed") {
        const t = await generatedTask(gh, rid);
        if (t) setTask(t);
      }
      setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, 20000, !terminal, [rid, gh]);

  if (task) {
    return (
      <div className="fade-in" style={{ paddingTop: 28 }}>
        <div className="wrap">
          <div className="alert alert-info row" style={{ marginBottom: 8 }}>
            <IconCheck width={16} height={16} />
            <span>Released by the SecProbe generator{progress?.requester ? <> for <b>{progress.requester}</b></> : null}. This task is part of the public community pool and can be evaluated like any pool task.</span>
          </div>
        </div>
        <TaskView
          detail={task}
          summary={task.summary as never}
          back={<Link to="/generate" className="back-link"><IconArrowLeft width={14} height={14} /> Generate</Link>}
          evaluable
          evalRef={`generated:${rid}`}
          extraActions={
            <>
              <button className="btn btn-ghost" disabled={!gh} onClick={() => gh?.downloadFile(CONFIG.generatedRepo, `generated/${rid}/bundle.tar.gz`, `${rid}.tar.gz`).catch((e) => setError(String(e.message || e)))}><IconDownload /> Harbor bundle</button>
              <a className="btn btn-ghost" href={`https://github.com/${CONFIG.generatedRepo}/tree/main/generated/${rid}`} target="_blank" rel="noreferrer">Community pool <IconExternal /></a>
            </>
          }
        />
      </div>
    );
  }

  const stages = progress?.stages ?? GEN_STAGES.map((s) => ({ key: s.key, label: s.label, state: "pending" as const }));
  const cancelled = status?.conclusion === "cancelled";
  const failed = progress?.status === "failed" || (status?.status === "completed" && status.conclusion !== "success" && progress?.status !== "passed");
  const waiting = !progress && (!status || status.status === "pending" || status.status === "queued");
  const mine = Boolean(user && progress?.requester && progress.requester.toLowerCase() === user.login.toLowerCase()) || (!progress && Boolean(user));
  const started = status?.created_at ?? null;

  return (
    <div className="wrap console fade-in" style={{ paddingTop: 28 }}>
      <Link to="/generate" className="back-link" style={{ marginBottom: 24, display: "inline-flex" }}><IconArrowLeft width={14} height={14} /> Generate</Link>
      <div className="mon-head">
        <div>
          <p className="eyebrow">Task synthesis · <span className="mono" style={{ textTransform: "none" }}>{rid}</span></p>
          <h1 className="h1" style={{ fontSize: "clamp(28px, 4vw, 40px)" }}>
            {cancelled ? "Generation cancelled." : failed ? "Generation did not pass release." : waiting ? "Waiting for a generator slot…" : "Building your task…"}
          </h1>
          <div className="row-wrap" style={{ marginTop: 12 }}>
            <span className={`status-pill ${failed ? "st-failed" : waiting ? "st-queued" : "st-running"}`}>
              {!failed && <span className="live-dot" />}
              {failed ? (cancelled ? "Cancelled" : "Failed") : waiting ? "Queued" : "Running"}
            </span>
            <span className="faint" style={{ fontSize: 13 }}>
              {started ? `requested ${timeAgo(started)} · ` : ""}{progress ? `last update ${timeAgo(progress.updated_at)} · ` : ""}page refreshes automatically
            </span>
          </div>
        </div>
        <div className="row-wrap">
          <button className="btn btn-sm" onClick={() => navigator.clipboard?.writeText(location.href).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); })}>
            {copied ? <><IconCheck /> Link copied</> : <><IconCopy /> Share</>}
          </button>
          {mine && token && !failed && status?.status !== "completed" && (
            <button className="btn btn-sm btn-ghost" onClick={async () => { if (confirm("Stop this generation?")) { try { await hostedCancel(token, rid); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } } }}>
              <IconStop /> Cancel
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-warn" style={{ marginBottom: 20 }}>Could not refresh: {error}</div>}
      {failed && progress?.note && <div className="alert alert-err" style={{ marginBottom: 20 }}>{progress.note}</div>}
      {waiting && <p className="hint" style={{ marginBottom: 20 }}>Generations run one at a time per slot on the SecProbe generator; a typical run takes 30–70 minutes once started. You can close this page and come back via the link.</p>}

      <div className="gen-grid">
        <ol className="stages">
          {stages.map((s, i) => {
            const meta = GEN_STAGES.find((g) => g.key === s.key);
            return (
              <li key={s.key} className={`stage stage-${s.state}`}>
                <span className="stage-dot">{s.state === "done" ? <IconCheck width={13} height={13} /> : s.state === "failed" ? <IconX width={13} height={13} /> : s.state === "running" ? <span className="spinner" style={{ width: 12, height: 12 }} /> : i + 1}</span>
                <div>
                  <div className="stage-title">{s.label}</div>
                  {meta && <div className="hint">{meta.blurb}</div>}
                </div>
                <span className="faint" style={{ fontSize: 12 }}>{s.state === "running" ? "in progress" : s.state}</span>
              </li>
            );
          })}
        </ol>
        <div>
          <div className="eyebrow">Events</div>
          <pre className="logbox" style={{ maxHeight: 520, minHeight: 200 }}>{progress?.log_tail || "Waiting for the first progress update…"}</pre>
        </div>
      </div>
    </div>
  );
}
