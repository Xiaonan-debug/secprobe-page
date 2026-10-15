// Method figures: the adaptive outer loop, the multi-agent synthesis inner loop, and a 2PL-IRT explorable.
import { useEffect, useMemo, useState } from "react";
import { GEN_STAGES } from "../lib/runner";
import "./method.css";

const LOOP = [
  { key: "config", title: "Configuration", math: "(c, s, h)", body: "A target CWE class c, a software specification s (language, application context, architecture) and a difficulty-control vector h = (h_repo, h_arch, h_vuln, h_eval)." },
  { key: "synth", title: "Task synthesis", math: "x ~ D(c, s, h)", body: "Five specialist agents build a repository-scale vulnerable project with exploit tests, functional tests and a reference patch. Only tasks that pass deterministic release checks enter the pool." },
  { key: "eval", title: "Agent evaluation", math: "y_ij ∈ {0, 1}", body: "Each coding agent must find and repair the hidden vulnerabilities. Success requires T_func = 1 and T_sec = 1 on the patched repository: tested functionality preserved, every tested exploit blocked." },
  { key: "irt", title: "Bayesian 2PL-IRT", math: "σ(α_i(θ_j − β_i))", body: "A Bayesian two-parameter logistic model jointly estimates agent ability θ, task difficulty β and discrimination α from all accumulated outcomes, with posterior uncertainty." },
  { key: "gap", title: "Information gap", math: "G_t(θ)", body: "Where is the agent pool concentrated but the task pool uninformative? G_t(θ) weighs agent density against the Fisher information current tasks provide; its maximum sets the target difficulty β*." },
  { key: "policy", title: "Next-task policy", math: "(α*, β*)", body: "Select existing tasks that match the target. If none are suitable, map (α*, β*) to the closest generation configuration (c*, s*, h*) and synthesize new tasks. Stop when the normalized maximum gap falls below threshold." },
];

function labelPos(p: { x: number; y: number }, cx: number, cy: number) {
  const dx = p.x - cx, dy = p.y - cy;
  if (Math.abs(dx) < 10) return { x: p.x, y: p.y + (dy < 0 ? -32 : 42), textAnchor: "middle" as const };
  return { x: p.x + (dx > 0 ? 30 : -30), y: p.y + 4, textAnchor: dx > 0 ? ("start" as const) : ("end" as const) };
}

export function AdaptiveLoop() {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => setActive((a) => (a + 1) % LOOP.length), 3800);
    return () => clearInterval(t);
  }, [auto]);

  const R = 150, cx = 200, cy = 190;
  const pts = LOOP.map((_, i) => {
    const a = -Math.PI / 2 + (i / LOOP.length) * Math.PI * 2;
    return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a), a };
  });
  const arc = (i: number) => {
    const a0 = pts[i].a + 0.27, a1 = pts[(i + 1) % LOOP.length].a - 0.27 + (i === LOOP.length - 1 ? Math.PI * 2 : 0);
    const p0 = { x: cx + R * Math.cos(a0), y: cy + R * Math.sin(a0) };
    const p1 = { x: cx + R * Math.cos(a1), y: cy + R * Math.sin(a1) };
    return `M${p0.x},${p0.y} A${R},${R} 0 0 1 ${p1.x},${p1.y}`;
  };

  return (
    <div className="loop">
      <svg viewBox="-60 0 520 380" className="loop-svg" role="img" aria-label="SecProbe adaptive evaluation loop">
        <defs>
          <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--line-strong)" />
          </marker>
          <marker id="arr-a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--accent)" />
          </marker>
        </defs>
        {LOOP.map((_, i) => (
          <path key={i} d={arc(i)} fill="none" stroke={i === active ? "var(--accent)" : "var(--line-strong)"} strokeWidth={i === active ? 2 : 1.25} markerEnd={`url(#${i === active ? "arr-a" : "arr"})`} />
        ))}
        <text x={cx} y={cy - 12} textAnchor="middle" className="loop-center">observe</text>
        <text x={cx} y={cy + 8} textAnchor="middle" className="loop-center-sub">then</text>
        <text x={cx} y={cy + 30} textAnchor="middle" className="loop-center">act</text>
        {LOOP.map((s, i) => (
          <g key={s.key} className={`loop-node ${i === active ? "on" : ""}`} onClick={() => { setActive(i); setAuto(false); }} tabIndex={0} role="button" aria-label={s.title}
             onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { setActive(i); setAuto(false); } }}>
            <circle cx={pts[i].x} cy={pts[i].y} r={22} />
            <text x={pts[i].x} y={pts[i].y + 4} textAnchor="middle" className="loop-idx">{i + 1}</text>
            <text {...labelPos(pts[i], cx, cy)} className="loop-label">{s.title}</text>
          </g>
        ))}
      </svg>
      <div className="loop-card fade-in" key={active}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Step {active + 1} of {LOOP.length}</div>
        <div className="h2" style={{ fontSize: 26 }}>{LOOP[active].title}</div>
        <div className="loop-math mono">{LOOP[active].math}</div>
        <p className="prose" style={{ fontSize: 16.5, margin: 0 }}>{LOOP[active].body}</p>
        <div className="row" style={{ marginTop: 18, gap: 6 }}>
          {LOOP.map((_, i) => (
            <button key={i} className={`loop-pip ${i === active ? "on" : ""}`} onClick={() => { setActive(i); setAuto(false); }} aria-label={`Step ${i + 1}`} />
          ))}
          <span className="spacer" />
          <button className="btn btn-sm btn-ghost" onClick={() => setAuto((a) => !a)}>{auto ? "Pause" : "Play"}</button>
        </div>
      </div>
    </div>
  );
}

export function SynthesisChain() {
  const agents = GEN_STAGES.slice(0, 5);
  const out = ["CWE security profile φ_c", "Blueprint b", "Test strategy q", "Executable task x + reference Δ*", "pass / revise"];
  return (
    <div className="chain">
      {agents.map((a, i) => (
        <div className="chain-node" key={a.key}>
          <div className="chain-idx mono">{String(i + 1).padStart(2, "0")}</div>
          <div className="chain-title">{a.label}</div>
          <div className="chain-blurb">{a.blurb}</div>
          <div className="chain-out mono">→ {out[i]}</div>
        </div>
      ))}
      <div className="chain-revise" aria-hidden="true">
        <svg viewBox="0 0 1000 40" preserveAspectRatio="none">
          <path d="M900,4 C900,34 900,34 870,34 L130,34 C100,34 100,34 100,4" fill="none" stroke="var(--vuln)" strokeWidth="1.5" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
        </svg>
        <span>revise · findings routed back to the responsible agent</span>
      </div>
    </div>
  );
}

const sig = (x: number) => 1 / (1 + Math.exp(-x));

export function IrtExplorer() {
  const [alpha, setAlpha] = useState(1.6);
  const [beta, setBeta] = useState(0.4);
  const [theta, setTheta] = useState(-0.6);
  const W = 520, H = 240, P = { l: 36, r: 12, t: 14, b: 30 };
  const xs = (t: number) => P.l + ((t + 3) / 6) * (W - P.l - P.r);
  const ys = (p: number) => H - P.b - p * (H - P.t - P.b);

  const { icc, info, infoMax } = useMemo(() => {
    const pts: [number, number][] = [], inf: [number, number][] = [];
    let m = 0;
    for (let t = -3; t <= 3.0001; t += 0.05) {
      const p = sig(alpha * (t - beta));
      const I = alpha * alpha * p * (1 - p);
      pts.push([t, p]); inf.push([t, I]); m = Math.max(m, I);
    }
    return { icc: pts, info: inf, infoMax: m };
  }, [alpha, beta]);

  const scaleI = 1 / Math.max(infoMax, 1.0);
  const iccPath = icc.map(([t, p], i) => `${i ? "L" : "M"}${xs(t).toFixed(1)},${ys(p).toFixed(1)}`).join("");
  const infoPath = `M${xs(-3)},${ys(0)}` + info.map(([t, I]) => `L${xs(t).toFixed(1)},${ys(I * scaleI).toFixed(1)}`).join("") + `L${xs(3)},${ys(0)}Z`;
  const pTheta = sig(alpha * (theta - beta));

  return (
    <div className="irt">
      <svg viewBox={`0 0 ${W} ${H}`} className="irt-svg" role="img" aria-label="Item characteristic curve and item information">
        {[0, 0.25, 0.5, 0.75, 1].map((p) => (
          <g key={p}>
            <line x1={P.l} x2={W - P.r} y1={ys(p)} y2={ys(p)} stroke="var(--line)" />
            <text x={P.l - 8} y={ys(p) + 4} textAnchor="end" className="irt-tick">{p}</text>
          </g>
        ))}
        {[-3, -2, -1, 0, 1, 2, 3].map((t) => (
          <text key={t} x={xs(t)} y={H - 10} textAnchor="middle" className="irt-tick">{t}</text>
        ))}
        <path d={infoPath} fill="var(--accent-soft)" stroke="none" />
        <line x1={xs(beta)} x2={xs(beta)} y1={ys(0)} y2={ys(1)} stroke="var(--accent)" strokeDasharray="3 4" />
        <path d={iccPath} fill="none" stroke="var(--ink)" strokeWidth="2" />
        <line x1={xs(theta)} x2={xs(theta)} y1={ys(0)} y2={ys(pTheta)} stroke="var(--vuln)" strokeWidth="1.5" />
        <circle cx={xs(theta)} cy={ys(pTheta)} r="5" fill="var(--vuln)" />
        <text x={xs(beta) + 6} y={ys(1) + 12} className="irt-ann">β (difficulty)</text>
        <text x={W - P.r} y={ys(0) - 6} textAnchor="end" className="irt-ann" style={{ fill: "var(--accent)" }}>information α²p(1−p)</text>
      </svg>
      <div className="irt-controls">
        <label className="field">
          <span className="label">Agent ability θ <span className="mono faint">{theta.toFixed(2)}</span></span>
          <input type="range" min={-3} max={3} step={0.05} value={theta} onChange={(e) => setTheta(+e.target.value)} />
        </label>
        <label className="field">
          <span className="label">Task difficulty β <span className="mono faint">{beta.toFixed(2)}</span></span>
          <input type="range" min={-2.5} max={2.5} step={0.05} value={beta} onChange={(e) => setBeta(+e.target.value)} />
        </label>
        <label className="field">
          <span className="label">Discrimination α <span className="mono faint">{alpha.toFixed(2)}</span></span>
          <input type="range" min={0.3} max={4} step={0.05} value={alpha} onChange={(e) => setAlpha(+e.target.value)} />
        </label>
        <div className="irt-readout">
          <span className="mono">Pr(y = 1) = σ(α(θ − β)) =</span>
          <b className="num">{pTheta.toFixed(3)}</b>
        </div>
        <p className="hint" style={{ margin: 0 }}>
          A task is most informative about agents whose ability sits near its difficulty, and more so when discrimination is high.
          SecProbe looks for ability regions where agents cluster but this shaded information is thin, then selects or synthesizes tasks there.
        </p>
      </div>
    </div>
  );
}
