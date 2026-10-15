// Per-task static-analysis view: tool runs, findings, module dependency graph, complexity treemap.
import { useMemo, useRef, useState } from "react";
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, SimulationNodeDatum } from "d3-force";
import { hierarchy, treemap, treemapSquarify } from "d3-hierarchy";
import { Finding, SEVERITY, Severity, TaskAnalysis, seq, seqInk, toolLabel } from "../lib/analysis";
import { IconCheck, IconX } from "./Icons";
import "./analysis.css";

export function AnalysisPanel({ a, onOpen }: { a: TaskAnalysis; onOpen: (path: string, line?: number) => void }) {
  const ran = a.tools.filter((t) => t.status === "ok");
  const sev = (s: Severity) => a.findings.filter((f) => f.severity === s).length;
  const filesWith = new Set(a.findings.map((f) => f.path)).size;
  const maxCcn = Math.max(0, ...a.metrics.files.map((f) => f.max_ccn));
  const byTool = useMemo(() => {
    const m: Record<string, number> = {};
    a.findings.forEach((f) => { m[f.tool] = (m[f.tool] ?? 0) + 1; });
    return a.tools.filter((t) => t.id !== "lizard").map((t) => ({ id: t.id, n: m[t.id] ?? 0, status: t.status })).sort((x, y) => y.n - x.n);
  }, [a]);
  const maxTool = Math.max(1, ...byTool.map((t) => t.n));

  return (
    <div className="an">
      <p className="an-note">
        Findings are what each tool reports on the vulnerable repository the agent receives. They are not labeled as true or false positives:
        many point at legitimate code, and some seeded vulnerabilities are invisible to every tool. The benchmark-wide comparison is on the{" "}
        <a href="#/analysis">SAST vs. agents</a> page.
      </p>

      <div className="an-tools">
        {a.tools.map((t) => (
          <span key={t.id} className={`an-tool st-${t.status}`} title={`${t.label} ${t.version}${t.note ? ` — ${t.note}` : ""}`}>
            {t.status === "ok" ? <IconCheck width={12} height={12} /> : <IconX width={12} height={12} />}
            {t.label}
            <span className="faint mono">{t.status === "ok" ? t.version : t.status}</span>
          </span>
        ))}
      </div>

      <dl className="an-stats num">
        <div><dt>Findings</dt><dd>{a.findings.length}</dd></div>
        <div><dt>By severity</dt><dd className="an-sev">
          {(["error", "warning", "note"] as Severity[]).map((s) => <span key={s}><i style={{ background: SEVERITY[s].color }} />{sev(s)} <small>{SEVERITY[s].label.toLowerCase()}</small></span>)}
        </dd></div>
        <div><dt>Files flagged</dt><dd>{filesWith}<span className="faint" style={{ fontSize: 16 }}> / {a.metrics.files.length}</span></dd></div>
        <div><dt>Tools run</dt><dd>{ran.length}</dd></div>
        <div><dt>Max cyclomatic complexity</dt><dd>{maxCcn}</dd></div>
      </dl>

      <section className="an-sec">
        <h3 className="h3">Findings by tool</h3>
        <div className="an-bars">
          {byTool.map((t) => (
            <div className="an-bar-row" key={t.id}>
              <span className="an-bar-label">{toolLabel(t.id)}</span>
              <span className="an-bar-track">{t.status === "ok" ? <span style={{ width: `${(t.n / maxTool) * 100}%` }} /> : null}</span>
              <span className="an-bar-n num">{t.status === "ok" ? t.n : <span className="faint">{t.status}</span>}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="an-grid2">
        <section className="an-sec">
          <h3 className="h3">Module dependency graph</h3>
          <p className="hint" style={{ margin: "4px 0 12px" }}>Files and the imports between them. Size = lines of code; hover to trace neighbours, click to open.</p>
          <DepGraph a={a} onOpen={onOpen} />
        </section>
        <section className="an-sec">
          <h3 className="h3">Complexity map</h3>
          <p className="hint" style={{ margin: "4px 0 12px" }}>Area = lines of code, shade = highest cyclomatic complexity in the file.</p>
          <Treemap a={a} onOpen={onOpen} />
        </section>
      </div>

      <section className="an-sec">
        <FindingsTable findings={a.findings} onOpen={onOpen} />
      </section>

      <section className="an-sec">
        <h3 className="h3" style={{ marginBottom: 10 }}>Most complex functions</h3>
        <div className="card scroll-x">
          <table className="table">
            <thead><tr><th>Function</th><th>Location</th><th style={{ textAlign: "right" }}>CCN</th><th style={{ textAlign: "right" }}>NLOC</th><th style={{ textAlign: "right" }}>Params</th></tr></thead>
            <tbody>
              {a.metrics.functions.slice(0, 15).map((f, i) => (
                <tr key={i}>
                  <td className="mono" style={{ fontSize: 12.5 }}>{f.name}</td>
                  <td><button className="linkish mono" onClick={() => onOpen(f.path, f.line)}>{f.path}:{f.line}</button></td>
                  <td className="num" style={{ textAlign: "right" }}><span className="ccn" style={{ background: seq(Math.min(1, f.ccn / 25)), color: seqInk(Math.min(1, f.ccn / 25)) }}>{f.ccn}</span></td>
                  <td className="num muted" style={{ textAlign: "right" }}>{f.nloc}</td>
                  <td className="num muted" style={{ textAlign: "right" }}>{f.params}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function FindingsTable({ findings, onOpen }: { findings: Finding[]; onOpen: (p: string, l?: number) => void }) {
  const [tool, setTool] = useState("");
  const [sev, setSev] = useState("");
  const [q, setQ] = useState("");
  const tools = Array.from(new Set(findings.map((f) => f.tool)));
  const rows = findings
    .filter((f) => (!tool || f.tool === tool) && (!sev || f.severity === sev) &&
      (!q || `${f.rule} ${f.title} ${f.message} ${f.path} ${f.cwe.join(" ")}`.toLowerCase().includes(q.toLowerCase())))
    .sort((x, y) => SEVERITY[x.severity].rank - SEVERITY[y.severity].rank || x.path.localeCompare(y.path) || x.line - y.line);
  return (
    <>
      <div className="row-wrap" style={{ marginBottom: 10 }}>
        <h3 className="h3">All findings <span className="faint num" style={{ fontWeight: 400 }}>{rows.length}</span></h3>
        <span className="spacer" />
        <select className="select" style={{ width: "auto", height: 32 }} value={tool} onChange={(e) => setTool(e.target.value)} aria-label="Tool">
          <option value="">All tools</option>
          {tools.map((t) => <option key={t} value={t}>{toolLabel(t)}</option>)}
        </select>
        <select className="select" style={{ width: "auto", height: 32 }} value={sev} onChange={(e) => setSev(e.target.value)} aria-label="Severity">
          <option value="">All severities</option>
          {(["error", "warning", "note"] as Severity[]).map((s) => <option key={s} value={s}>{SEVERITY[s].label}</option>)}
        </select>
        <input className="input" style={{ width: 220, height: 32 }} placeholder="Filter rule, CWE, file…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter findings" />
      </div>
      <div className="card scroll-x" style={{ maxHeight: 520, overflowY: "auto" }}>
        <table className="table an-ftable">
          <thead><tr><th>Severity</th><th>Tool</th><th>Rule</th><th>CWE</th><th>Location</th></tr></thead>
          <tbody>
            {rows.map((f, i) => (
              <tr key={i}>
                <td><span className="sev" style={{ ["--c" as string]: SEVERITY[f.severity].color }}>{SEVERITY[f.severity].label}</span></td>
                <td style={{ whiteSpace: "nowrap" }}>{toolLabel(f.tool)}</td>
                <td><div style={{ fontWeight: 500, fontSize: 13 }}>{f.title}</div><div className="faint" style={{ fontSize: 12, maxWidth: 520 }}>{f.message.slice(0, 180)}{f.message.length > 180 ? "…" : ""}</div></td>
                <td className="mono" style={{ fontSize: 11.5, whiteSpace: "nowrap" }}>{f.cwe.join(", ") || "—"}</td>
                <td><button className="linkish mono" onClick={() => onOpen(f.path, f.line)}>{f.path}:{f.line}</button></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="muted" style={{ textAlign: "center", padding: 24 }}>No findings match.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

interface SimNode extends SimulationNodeDatum { id: string; kind: string; nloc: number; max_ccn: number; findings: number; r: number }

function DepGraph({ a, onOpen }: { a: TaskAnalysis; onOpen: (p: string) => void }) {
  const [hover, setHover] = useState<string | null>(null);
  const [colorBy, setColorBy] = useState<"complexity" | "findings">("complexity");
  const W = 640, H = 460;
  const layout = useMemo(() => {
    const maxN = Math.max(1, ...a.graph.nodes.map((n) => n.nloc));
    const nodes: SimNode[] = a.graph.nodes.map((n) => ({ ...n, r: 4 + 10 * Math.sqrt(n.nloc / maxN) }));
    const ids = new Set(nodes.map((n) => n.id));
    const links = a.graph.edges.filter((e) => ids.has(e.source) && ids.has(e.target) && e.source !== e.target).map((e) => ({ ...e }));
    const sim = forceSimulation(nodes)
      .force("link", forceLink<SimNode, { source: string; target: string }>(links).id((d) => d.id).distance(70).strength(0.35))
      .force("charge", forceManyBody().strength(-260).distanceMax(400))
      .force("center", forceCenter(W / 2, H / 2))
      .force("x", forceX(W / 2).strength(0.12))
      .force("y", forceY(H / 2).strength(0.16))
      .force("collide", forceCollide<SimNode>((d) => d.r + 8))
      .stop();
    for (let i = 0; i < 400; i++) sim.tick();
    // Fit the layout to the viewport so dense graphs use the whole canvas.
    // Horizontal padding leaves room for file-name labels centred under edge nodes.
    const padX = 70, padY = 24;
    const xs = nodes.map((n) => n.x ?? 0), ys = nodes.map((n) => n.y ?? 0);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const k = Math.min((W - 2 * padX) / Math.max(1, x1 - x0), (H - 2 * padY - 12) / Math.max(1, y1 - y0));
    nodes.forEach((n) => {
      n.x = padX + ((n.x ?? 0) - x0) * k + (W - 2 * padX - (x1 - x0) * k) / 2;
      n.y = padY + ((n.y ?? 0) - y0) * k + (H - 2 * padY - 12 - (y1 - y0) * k) / 2;
    });
    return { nodes, links: links as unknown as { source: SimNode; target: SimNode }[] };
  }, [a, W, H]);

  const neighbours = useMemo(() => {
    if (!hover) return null;
    const s = new Set([hover]);
    layout.links.forEach((l) => { if (l.source.id === hover) s.add(l.target.id); if (l.target.id === hover) s.add(l.source.id); });
    return s;
  }, [hover, layout]);
  const maxF = Math.max(1, ...layout.nodes.map((n) => n.findings));
  const fill = (n: SimNode) => (colorBy === "complexity" ? seq(Math.min(1, n.max_ccn / 25)) : n.findings ? seq(0.25 + 0.75 * (n.findings / maxF)) : "var(--bg-sunken)");
  const hn = layout.nodes.find((n) => n.id === hover);

  if (!a.graph.nodes.length) return <div className="empty-box">No intra-repository imports were resolved for this language.</div>;
  return (
    <div className="dg">
      <div className="row-wrap" style={{ marginBottom: 8 }}>
        <div className="seg" role="group" aria-label="Color nodes by">
          <button aria-pressed={colorBy === "complexity"} onClick={() => setColorBy("complexity")}>Complexity</button>
          <button aria-pressed={colorBy === "findings"} onClick={() => setColorBy("findings")}>Findings</button>
        </div>
        <span className="spacer" />
        <Ramp label={colorBy === "complexity" ? "max CCN 0 → 25+" : `findings 0 → ${maxF}`} />
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="dg-svg" role="img" aria-label="Module dependency graph" onMouseLeave={() => setHover(null)}>
        <defs>
          <marker id="dg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--line-strong)" />
          </marker>
        </defs>
        {layout.links.map((l, i) => {
          const on = neighbours && neighbours.has(l.source.id) && neighbours.has(l.target.id) && (l.source.id === hover || l.target.id === hover);
          const dx = (l.target.x ?? 0) - (l.source.x ?? 0), dy = (l.target.y ?? 0) - (l.source.y ?? 0), d = Math.hypot(dx, dy) || 1;
          return (
            <line key={i} x1={l.source.x} y1={l.source.y} x2={(l.target.x ?? 0) - (dx / d) * (l.target.r + 2)} y2={(l.target.y ?? 0) - (dy / d) * (l.target.r + 2)}
              stroke={on ? "var(--ink)" : "var(--line-strong)"} strokeWidth={on ? 1.5 : 1} opacity={neighbours && !on ? 0.15 : 0.8} markerEnd="url(#dg-arrow)" />
          );
        })}
        {layout.nodes.map((n) => (
          <g key={n.id} transform={`translate(${n.x},${n.y})`} className="dg-node" opacity={neighbours && !neighbours.has(n.id) ? 0.25 : 1}
            onMouseEnter={() => setHover(n.id)} onClick={() => onOpen(n.id)} tabIndex={0} role="button" aria-label={n.id}
            onFocus={() => setHover(n.id)} onKeyDown={(e) => e.key === "Enter" && onOpen(n.id)}>
            <circle r={n.r + 6} fill="transparent" />
            <circle r={n.r} fill={n.kind === "test" ? "var(--bg-raised)" : fill(n)} stroke={n.kind === "test" ? "var(--ink-2)" : "var(--bg-raised)"} strokeWidth={n.kind === "test" ? 1.5 : 2} strokeDasharray={n.kind === "test" ? "2 2" : undefined} />
            {(n.r > 7 || hover === n.id || (neighbours?.has(n.id) ?? false)) && <text y={n.r + 11} textAnchor="middle" className="dg-label">{n.id.split("/").pop()}</text>}
          </g>
        ))}
      </svg>
      {hn && (
        <div className="dg-tip">
          <div className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{hn.id}</div>
          <div className="faint num" style={{ fontSize: 11.5 }}>{hn.kind} · {hn.nloc} NLOC · max CCN {hn.max_ccn} · {hn.findings} findings · {neighbours!.size - 1} linked</div>
        </div>
      )}
      <div className="hint" style={{ marginTop: 6 }}>Dashed outline = test file. {a.graph.nodes.length} files, {a.graph.edges.length} import edges.</div>
    </div>
  );
}

function Treemap({ a, onOpen }: { a: TaskAnalysis; onOpen: (p: string) => void }) {
  const [tip, setTip] = useState<{ x: number; y: number; f: TaskAnalysis["metrics"]["files"][number] } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const W = 640, H = 460;
  const leaves = useMemo(() => {
    type T = { name: string; children?: T[]; file?: TaskAnalysis["metrics"]["files"][number] };
    const root: T = { name: "", children: [] };
    a.metrics.files.filter((f) => f.nloc > 0).forEach((f) => {
      const parts = f.path.split("/");
      let cur = root;
      parts.slice(0, -1).forEach((p) => {
        let next = cur.children!.find((c) => c.name === p && c.children);
        if (!next) { next = { name: p, children: [] }; cur.children!.push(next); }
        cur = next;
      });
      cur.children!.push({ name: parts[parts.length - 1], file: f });
    });
    const h = hierarchy<T>(root).sum((d) => d.file?.nloc ?? 0).sort((x, y) => (y.value ?? 0) - (x.value ?? 0));
    treemap<T>().tile(treemapSquarify).size([W, H]).paddingInner(2).paddingTop((d) => (d.depth > 0 && d.children ? 14 : 0)).round(true)(h);
    return h.descendants() as unknown as { x0: number; y0: number; x1: number; y1: number; depth: number; data: T; children?: unknown[] }[];
  }, [a]);

  return (
    <div className="tm" ref={box} onMouseLeave={() => setTip(null)}>
      <div className="row-wrap" style={{ marginBottom: 8, minHeight: 34 }}>
        <span className="spacer" />
        <Ramp label="max CCN 0 → 25+" />
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="tm-svg" role="img" aria-label="Complexity treemap">
        {leaves.filter((d) => d.depth > 0).map((d, i) => {
          const w = d.x1 - d.x0, h = d.y1 - d.y0;
          if (d.data.file) {
            const f = d.data.file;
            return (
              <g key={i} className="tm-cell" onClick={() => onOpen(f.path)}
                onMouseMove={(e) => { const r = box.current!.getBoundingClientRect(); setTip({ x: e.clientX - r.left, y: e.clientY - r.top, f }); }}>
                <rect x={d.x0} y={d.y0} width={w} height={h} rx={3} fill={seq(Math.min(1, f.max_ccn / 25))} />
                {f.findings > 0 && w > 14 && h > 14 && <circle cx={d.x1 - 7} cy={d.y0 + 7} r={3.5} fill="var(--st-critical)" stroke="var(--bg-raised)" strokeWidth={1.5} />}
                {w > 58 && h > 20 && <text x={d.x0 + 6} y={d.y0 + 15} className="tm-label" style={{ fill: seqInk(Math.min(1, f.max_ccn / 25)) }}>{d.data.name.length > w / 6.5 ? d.data.name.slice(0, Math.floor(w / 6.5) - 1) + "…" : d.data.name}</text>}
              </g>
            );
          }
          return w > 40 ? <text key={i} x={d.x0 + 2} y={d.y0 + 10} className="tm-dir">{d.data.name}/</text> : null;
        })}
      </svg>
      {tip && (
        <div className="dg-tip" style={{ left: Math.min(tip.x + 12, (box.current?.clientWidth ?? 300) - 230), top: tip.y + 12, right: "auto", bottom: "auto", position: "absolute" }}>
          <div className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{tip.f.path}</div>
          <div className="faint num" style={{ fontSize: 11.5 }}>{tip.f.nloc} NLOC · {tip.f.functions} functions · avg CCN {tip.f.avg_ccn.toFixed(1)} · max {tip.f.max_ccn} · {tip.f.findings} findings</div>
        </div>
      )}
      <div className="hint" style={{ marginTop: 6 }}>Red dot = file has at least one finding.</div>
    </div>
  );
}

function Ramp({ label }: { label: string }) {
  return (
    <span className="ramp">
      {[0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6, 1].map((t) => <i key={t} style={{ background: seq(t) }} />)}
      <span className="faint" style={{ fontSize: 11.5, marginLeft: 6 }}>{label}</span>
    </span>
  );
}
