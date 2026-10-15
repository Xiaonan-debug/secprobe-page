// Method figures: the adaptive outer loop, the multi-agent synthesis inner loop, and a 2PL-IRT explorable.
import { useEffect, useMemo, useState } from "react";
import { GEN_STAGES } from "../lib/runner";
import { Math as LatexMath } from "./Math";
import "./method.css";

const LOOP = [
  { key: "config", title: "Configuration", math: String.raw`(c, s, \mathbf{h})`, body: <>A target CWE class <LatexMath tex="c" />, a software specification <LatexMath tex="s" /> (language, application context, architecture) and a difficulty-control vector <LatexMath tex={String.raw`\mathbf{h} = (h_{\mathrm{repo}}, h_{\mathrm{arch}}, h_{\mathrm{vuln}}, h_{\mathrm{eval}})`} />.</> },
  { key: "synth", title: "Task synthesis", math: String.raw`x \sim \mathcal{D}(c, s, \mathbf{h})`, body: <>Five specialist agents build a repository-scale vulnerable project with exploit tests, functional tests and a reference patch. Only tasks that pass deterministic release checks enter the pool.</> },
  { key: "eval", title: "Agent evaluation", math: String.raw`y_{ij} \in \{0, 1\}`, body: <>Each coding agent must find and repair the hidden vulnerabilities. Success requires <LatexMath tex={String.raw`T_{\mathrm{func}} = 1`} /> and <LatexMath tex={String.raw`T_{\mathrm{sec}} = 1`} /> on the patched repository: tested functionality preserved, every tested exploit blocked.</> },
  { key: "irt", title: "Bayesian 2PL-IRT", math: String.raw`\sigma\!\bigl(\alpha_i(\theta_j - \beta_i)\bigr)`, body: <>A Bayesian two-parameter logistic model jointly estimates agent ability <LatexMath tex={String.raw`\theta`} />, task difficulty <LatexMath tex={String.raw`\beta`} /> and discrimination <LatexMath tex={String.raw`\alpha`} /> from all accumulated outcomes, with posterior uncertainty.</> },
  { key: "gap", title: "Information gap", math: String.raw`G_t(\theta)`, body: <>Where is the agent pool concentrated but the task pool uninformative? <LatexMath tex={String.raw`G_t(\theta)`} /> weighs agent density against the Fisher information current tasks provide; its maximum sets the target difficulty <LatexMath tex={String.raw`\beta^{\ast}`} />.</> },
  { key: "policy", title: "Next-task policy", math: String.raw`(\alpha^{\ast}, \beta^{\ast})`, body: <>Select existing tasks that match the target. If none are suitable, map <LatexMath tex={String.raw`(\alpha^{\ast}, \beta^{\ast})`} /> to the closest generation configuration <LatexMath tex={String.raw`(c^{\ast}, s^{\ast}, \mathbf{h}^{\ast})`} /> and synthesize new tasks. Stop when the normalized maximum gap falls below threshold.</> },
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
        <div className="loop-math"><LatexMath tex={LOOP[active].math} display /></div>
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
  const out = [<>CWE security profile <LatexMath tex={String.raw`\phi_c`} /></>, <>Blueprint <LatexMath tex="b" /></>, <>Test strategy <LatexMath tex="q" /></>, <>Executable task <LatexMath tex="x" /> + reference <LatexMath tex={String.raw`\Delta^{\ast}`} /></>, "pass / revise"];
  return (
    <div className="chain">
      {agents.map((a, i) => (
        <div className="chain-node" key={a.key}>
          <div className="chain-idx mono">{String(i + 1).padStart(2, "0")}</div>
          <div className="chain-title">{a.label}</div>
          <div className="chain-blurb">{a.blurb}</div>
          <div className="chain-out">→ {out[i]}</div>
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
        <foreignObject x={Math.min(xs(beta) + 6, W - P.r - 110)} y={ys(1)} width={110} height={26}>
          <div className="irt-annotation"><LatexMath tex={String.raw`\beta`} /> (difficulty)</div>
        </foreignObject>
        <foreignObject x={W - P.r - 158} y={ys(0) - 28} width={158} height={26}>
          <div className="irt-annotation irt-information">information <LatexMath tex={String.raw`\alpha^2p(1-p)`} /></div>
        </foreignObject>
      </svg>
      <div className="irt-controls">
        <label className="field">
          <span className="label">Agent ability <LatexMath tex={String.raw`\theta`} /> <span className="mono faint">{theta.toFixed(2)}</span></span>
          <input type="range" min={-3} max={3} step={0.05} value={theta} onChange={(e) => setTheta(+e.target.value)} />
        </label>
        <label className="field">
          <span className="label">Task difficulty <LatexMath tex={String.raw`\beta`} /> <span className="mono faint">{beta.toFixed(2)}</span></span>
          <input type="range" min={-2.5} max={2.5} step={0.05} value={beta} onChange={(e) => setBeta(+e.target.value)} />
        </label>
        <label className="field">
          <span className="label">Discrimination <LatexMath tex={String.raw`\alpha`} /> <span className="mono faint">{alpha.toFixed(2)}</span></span>
          <input type="range" min={0.3} max={4} step={0.05} value={alpha} onChange={(e) => setAlpha(+e.target.value)} />
        </label>
        <div className="irt-readout">
          <LatexMath tex={String.raw`\Pr(y=1)=\sigma\!\bigl(\alpha(\theta-\beta)\bigr)=`} />
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
