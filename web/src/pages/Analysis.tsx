import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAsync } from "../lib/hooks";
import { CATEGORIES, LANGUAGES, Language, categoryColor, loadLeaderboard } from "../lib/data";
import { AnalysisSummary, Rate, loadAnalysisSummary, pct, seq, seqInk, toolLabel } from "../lib/analysis";
import { renderMarkdown } from "../lib/markdown";
import "./analysis-page.css";

export default function AnalysisPage() {
  const sum = useAsync(loadAnalysisSummary, []);
  const lb = useAsync(loadLeaderboard, []);

  return (
    <div className="wrap ap">
      <header className="ap-head">
        <p className="eyebrow">Static analysis · SAST vs. agents</p>
        <h1 className="h1">Do traditional security tools see what agents fail to fix?</h1>
        <p className="lede" style={{ maxWidth: 780, marginTop: 12 }}>
          We ran CodeQL, Semgrep and language-specific analyzers on every task, once on the vulnerable repository and once on the reference repair.
          A tool <em>detects</em> a task when it reports something on the vulnerable code that disappears after the reference fix.
        </p>
      </header>
      {sum.loading && <div className="spinner" />}
      {!sum.loading && !sum.data && (
        <div className="empty-box">The static-analysis results are being computed for all 353 tasks and will appear here shortly.</div>
      )}
      {sum.data && <Body s={sum.data} agents={lb.data?.rows ?? []} />}
    </div>
  );
}

type AgentRow = { model: string; mini: { pass: number }; terminus: { pass: number } };

/** Rates over fewer tasks than this are shown de-emphasised and never headlined. */
const MIN_N = 20;

function Body({ s, agents }: { s: AnalysisSummary; agents: AgentRow[] }) {
  const toolIds = s.tools.map((t) => t.id).filter((t) => t !== "lizard" && s.detection.by_tool[t]);
  const n = (t: string) => s.detection.by_tool[t]?.tasks ?? 0;
  // Well-sampled tools first (by rate), then small-sample tools (by rate).
  const sorted = [...toolIds].sort((a, b) => Number(n(b) >= MIN_N) - Number(n(a) >= MIN_N) || pct(s.detection.by_tool[b]) - pct(s.detection.by_tool[a]));
  const union = s.detection.by_tool.union;
  const best = sorted.find((t) => n(t) >= MIN_N) ?? sorted[0];
  const bestAgent = useMemo(() => [...agents].map((a) => ({ model: a.model, pass: Math.max(a.mini.pass, a.terminus.pass) })).sort((a, b) => b.pass - a.pass), [agents]);

  return (
    <>
      <dl className="ap-tiles num">
        <div><dt>Any tool detects</dt><dd className="acc">{pct(union).toFixed(1)}%</dd><span>of {union?.tasks ?? 0} tasks</span></div>
        <div><dt>Best single tool</dt><dd>{pct(s.detection.by_tool[best]).toFixed(1)}%</dd><span>{toolLabel(best)} · {n(best)} tasks</span></div>
        <div><dt>…with matching CWE category</dt><dd>{pct(union, "detected_cwe_match").toFixed(1)}%</dd><span>any tool</span></div>
        <div><dt>Best agent fully repairs</dt><dd>{bestAgent[0]?.pass.toFixed(2) ?? "28.33"}%</dd><span>{bestAgent[0]?.model ?? "GLM-5.3"} (paper)</span></div>
      </dl>

      <section className="ap-sec">
        <div className="ap-sec-head">
          <h2 className="h2">Detection versus repair</h2>
          <p className="muted">Share of tasks, on one axis. These are different jobs: a static analyzer only has to <b>point at</b> something the fix changes; an agent must <b>repair every seeded vulnerability</b> without breaking functionality.</p>
        </div>
        <CompareChart s={s} tools={sorted} agents={bestAgent} />
      </section>

      <section className="ap-sec">
        <div className="ap-sec-head">
          <h2 className="h2">By vulnerability category</h2>
          <p className="muted">Detection rate per tool and security category. Hover a cell for counts.</p>
        </div>
        <Heatmap rows={["union", ...sorted]} cols={CATEGORIES.filter((c) => s.detection.by_tool_category.union?.[c])} data={s.detection.by_tool_category}
          colHead={(c) => <><i className="cat-sw" style={{ background: categoryColor(c) }} />{c}</>} />
      </section>

      <section className="ap-sec">
        <div className="ap-sec-head">
          <h2 className="h2">By language</h2>
          <p className="muted">Tools only run where they support the language; empty cells mean not applicable.</p>
        </div>
        <Heatmap rows={["union", ...sorted]} cols={Object.keys(s.detection.by_tool_language.union ?? {}).sort((a, b) => (s.detection.by_tool_language.union[b]?.tasks ?? 0) - (s.detection.by_tool_language.union[a]?.tasks ?? 0))}
          data={s.detection.by_tool_language} colHead={(c) => LANGUAGES[c as Language]?.label ?? c} />
      </section>

      <section className="ap-sec">
        <div className="ap-sec-head">
          <h2 className="h2">Signal and noise</h2>
          <p className="muted">How much each tool reports, and how much of it the reference repair actually touches.</p>
        </div>
        <NoiseTable s={s} tools={sorted} />
      </section>

      <section className="ap-sec">
        <div className="ap-sec-head">
          <h2 className="h2">Coverage</h2>
          <p className="muted">Tasks each tool ran on successfully, per language.</p>
        </div>
        <Coverage s={s} tools={sorted} />
      </section>

      <section className="ap-sec">
        <div className="ap-sec-head"><h2 className="h2">Method and limits</h2></div>
        <div className="md ap-method" dangerouslySetInnerHTML={{ __html: renderMarkdown(s.method) }} />
        <p className="hint">
          Tool versions: {s.tools.map((t) => `${t.label} ${t.version}`).join(" · ")}. Generated {new Date(s.generated_at).toLocaleDateString()}.
          Per-task findings are browsable on every task page under <b>Static analysis</b>; e.g. <Link to="/tasks/patch-cwe94-0012?tab=analysis">Schema Loom</Link>.
        </p>
      </section>
    </>
  );
}

function CompareChart({ s, tools, agents }: { s: AnalysisSummary; tools: string[]; agents: { model: string; pass: number }[] }) {
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const rows: { kind: "tool" | "agent" | "head"; label: string; v?: number; v2?: number; note?: string; n?: number }[] = [
    { kind: "head", label: "Static analysis · detects (≥1 repair-attributable finding)" },
    { kind: "tool", label: toolLabel("union"), v: pct(s.detection.by_tool.union), v2: pct(s.detection.by_tool.union, "detected_cwe_match"), note: rateNote(s.detection.by_tool.union), n: s.detection.by_tool.union?.tasks },
    ...tools.map((t) => ({ kind: "tool" as const, label: toolLabel(t), v: pct(s.detection.by_tool[t]), v2: pct(s.detection.by_tool[t], "detected_cwe_match"), note: rateNote(s.detection.by_tool[t]), n: s.detection.by_tool[t]?.tasks })),
    { kind: "head", label: "Coding agents · fully repair (strict pass, best harness, paper)" },
    ...agents.slice(0, 9).map((a) => ({ kind: "agent" as const, label: a.model, v: a.pass })),
  ];
  return (
    <div className="cc" onMouseLeave={() => setTip(null)}>
      <div className="cc-legend">
        <span><i className="cc-sw tool" /> Detected</span>
        <span><i className="cc-sw match" /> Detected with matching CWE category</span>
        <span><i className="cc-sw agent" /> Fully repaired by agent</span>
        <span className="faint">Number after a tool = tasks it applies to; lighter rows cover fewer than {MIN_N} tasks.</span>
      </div>
      <div className="cc-axis"><span />{[0, 25, 50, 75, 100].map((t) => <em key={t} style={{ left: `${t}%` }}>{t}%</em>)}</div>
      {rows.map((r, i) =>
        r.kind === "head" ? (
          <div key={i} className="cc-head">{r.label}</div>
        ) : (
          <div key={i} className={`cc-row ${r.kind} ${r.n != null && r.n < MIN_N ? "small" : ""}`}
            onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, text: r.kind === "tool" ? `${r.label}: ${r.v!.toFixed(1)}% detected, ${r.v2!.toFixed(1)}% with matching CWE category${r.note ? ` (${r.note})` : ""}` : `${r.label}: ${r.v!.toFixed(2)}% strict pass on 353 tasks` })}>
            <span className="cc-label">{r.label}{r.n != null && <span className="cc-n num">{r.n}</span>}</span>
            <span className="cc-track">
              {[25, 50, 75].map((t) => <b key={t} style={{ left: `${t}%` }} />)}
              <span className={`cc-bar ${r.kind}`} style={{ width: `${r.v}%` }} />
              {r.kind === "tool" && <span className="cc-bar match" style={{ width: `${r.v2}%` }} />}
            </span>
            <span className="cc-val num">{r.v!.toFixed(1)}%</span>
          </div>
        ),
      )}
      {tip && <div className="cc-tip" style={{ left: tip.x + 14, top: tip.y + 14 }}>{tip.text}</div>}
    </div>
  );
}
const rateNote = (r?: Rate) => (r ? `${r.detected}/${r.tasks} tasks` : "");

function Heatmap({ rows, cols, data, colHead }: { rows: string[]; cols: string[]; data: Record<string, Record<string, Rate>>; colHead: (c: string) => React.ReactNode }) {
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  return (
    <div className="hm scroll-x" onMouseLeave={() => setTip(null)}>
      <table>
        <thead><tr><th />{cols.map((c) => <th key={c}>{colHead(c)}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r} className={r === "union" ? "hm-union" : ""}>
              <th>{toolLabel(r)}</th>
              {cols.map((c) => {
                const v = data[r]?.[c];
                if (!v || !v.tasks) return <td key={c} className="hm-na">·</td>;
                const p = pct(v);
                return (
                  <td key={c} style={{ background: seq(p / 100), color: seqInk(p / 100) }}
                    onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, text: `${toolLabel(r)} · ${c}: ${v.detected} of ${v.tasks} tasks (${p.toFixed(1)}%)` })}>
                    {Math.round(p)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="hm-foot"><span className="faint" style={{ fontSize: 11.5 }}>% of tasks detected</span>
        <span className="ramp">{[0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6, 1].map((t) => <i key={t} style={{ background: seq(t) }} />)}</span>
        <span className="faint" style={{ fontSize: 11.5 }}>0 → 100</span></div>
      {tip && <div className="cc-tip" style={{ left: tip.x + 14, top: tip.y + 14 }}>{tip.text}</div>}
    </div>
  );
}

function NoiseTable({ s, tools }: { s: AnalysisSummary; tools: string[] }) {
  const maxK = Math.max(1, ...tools.map((t) => s.noise[t]?.per_kloc ?? 0));
  return (
    <div className="card scroll-x">
      <table className="table">
        <thead><tr><th>Tool</th><th style={{ textAlign: "right" }}>Findings</th><th>Findings per 1k lines</th><th>Touched by the reference repair</th></tr></thead>
        <tbody>
          {tools.map((t) => {
            const n = s.noise[t];
            if (!n) return null;
            return (
              <tr key={t}>
                <td style={{ fontWeight: 500 }}>{toolLabel(t)}</td>
                <td className="num" style={{ textAlign: "right" }}>{n.findings.toLocaleString()}</td>
                <td><div className="nb"><span style={{ width: `${(n.per_kloc / maxK) * 100}%` }} /><em className="num">{n.per_kloc.toFixed(1)}</em></div></td>
                <td><div className="nb"><span className="acc" style={{ width: `${n.attributable_share * 100}%` }} /><em className="num">{(n.attributable_share * 100).toFixed(1)}%</em></div></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Coverage({ s, tools }: { s: AnalysisSummary; tools: string[] }) {
  const langs = Array.from(new Set(tools.flatMap((t) => Object.keys(s.coverage[t] ?? {}))));
  return (
    <div className="card scroll-x">
      <table className="table cov">
        <thead><tr><th>Tool</th>{langs.map((l) => <th key={l} style={{ textAlign: "center" }}>{LANGUAGES[l as Language]?.label ?? l}</th>)}</tr></thead>
        <tbody>
          {tools.map((t) => (
            <tr key={t}>
              <td style={{ fontWeight: 500 }}>{toolLabel(t)}</td>
              {langs.map((l) => {
                const c = s.coverage[t]?.[l];
                return <td key={l} className="num" style={{ textAlign: "center" }}>{c && c.tasks ? <span title={`${c.ok} ok, ${c.failed} failed of ${c.tasks}`}>{c.ok}<span className="faint">/{c.tasks}</span></span> : <span className="faint">—</span>}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
