import { useState } from "react";
import { Link } from "react-router-dom";
import { CONFIG, hfDatasetUrl } from "../lib/config";
import { useAsync } from "../lib/hooks";
import { CATEGORIES, LANGUAGES, LEVELS, Index, Language, Level, categoryColor, loadIndex, loadLeaderboard } from "../lib/data";
import { TaskWall } from "../components/TaskWall";
import { Leaderboard } from "../components/Leaderboard";
import { AdaptiveLoop, IrtExplorer, SynthesisChain } from "../components/Method";
import { IconArrowRight, IconCheck, IconCode, IconCopy, IconDatabase, IconPaper, IconPlay, IconSparkle } from "../components/Icons";
import "./home.css";

const AUTHORS: [string, string, boolean?][] = [
  ["Xiaonan Luo", "1,2", true], ["Yue Huang", "1,2", true], ["Kehan Guo", "1"], ["Ping He", "3"], ["Chuan Zou", "4"],
  ["Chujie Gao", "1"], ["Lichi Li", "2"], ["Yuchen Ma", "5"], ["Zhangchen Xu", "2,6"], ["Zichen Chen", "2,7"],
  ["Yufei Han", "8"], ["Xiangliang Zhang", "1"],
];
const AFFILS = ["University of Notre Dame", "Bake AI", "Vanderbilt University", "University of Pennsylvania", "LMU Munich", "University of Washington", "Stanford University", "Inria"];

const BIBTEX = `@article{luo2026secprobe,
  title   = {SecProbe: Adaptive Evaluation of Coding Agents on Cybersecurity Vulnerabilities},
  author  = {Luo, Xiaonan and Huang, Yue and Guo, Kehan and He, Ping and Zou, Chuan and Gao, Chujie and
             Li, Lichi and Ma, Yuchen and Xu, Zhangchen and Chen, Zichen and Han, Yufei and Zhang, Xiangliang},
  journal = {arXiv preprint arXiv:2609.33763},
  year    = {2026}
}`;

export default function Home() {
  const idx = useAsync(loadIndex, []);
  const lb = useAsync(loadLeaderboard, []);
  const counts = idx.data?.counts;

  return (
    <>
      {/* ------------------------------------------------------------ Hero */}
      <section className="hero">
        <div className="wrap">
          <p className="eyebrow fade-in">Research · Agent evaluation · Code security</p>
          <h1 className="display fade-in">SecProbe</h1>
          <p className="hero-sub fade-in">Adaptive evaluation of coding agents on cybersecurity vulnerabilities</p>

          <div className="authors fade-in">
            {AUTHORS.map(([n, a, eq], i) => (
              <span key={n}>{n}<sup>{a}{eq ? "*" : ""}</sup>{i < AUTHORS.length - 1 ? "" : ""}</span>
            ))}
          </div>
          <div className="affils fade-in">
            {AFFILS.map((a, i) => <span key={a}><sup>{i + 1}</sup>{a}</span>)}
            <span><sup>*</sup>Equal contribution</span>
          </div>

          <div className="row-wrap hero-ctas fade-in">
            <a className="btn btn-primary" href={CONFIG.paperUrl} target="_blank" rel="noreferrer"><IconPaper /> Paper</a>
            <a className="btn" href={CONFIG.codeUrl} target="_blank" rel="noreferrer"><IconCode /> Code</a>
            <a className="btn" href={hfDatasetUrl()} target="_blank" rel="noreferrer"><IconDatabase /> Dataset</a>
            <span className="hero-sep" />
            <Link className="btn btn-ghost" to="/tasks">Browse 353 tasks <IconArrowRight /></Link>
          </div>
        </div>

        <div className="wrap hero-figure">
          <div className="hero-figure-head">
            <div>
              <div className="h3">The task pool</div>
              <div className="muted" style={{ fontSize: 13.5 }}>Every cell is a repository-scale vulnerability-repair task. Hover to inspect, click to open its code.</div>
            </div>
            <Link to="/tasks" className="btn btn-sm">Open explorer <IconArrowRight /></Link>
          </div>
          {idx.data ? <TaskWall tasks={idx.data.tasks} /> : <div className="wall-skeleton" />}
        </div>

        <div className="wrap">
          <dl className="stats">
            <div><dt>Tasks</dt><dd className="num">{counts?.tasks ?? 353}</dd></div>
            <div><dt>CWE types</dt><dd className="num">{counts?.cwes ?? "—"}</dd></div>
            <div><dt>Languages</dt><dd className="num">{counts ? Object.keys(counts.languages).length : "—"}</dd></div>
            <div><dt>Models × harnesses</dt><dd className="num">9 × 2</dd></div>
            <div><dt>Best strict pass rate</dt><dd className="num accent">28.33%</dd></div>
            <div><dt>Fewer tasks vs. baselines</dt><dd className="num accent">−29.5%</dd></div>
          </dl>
        </div>
      </section>

      {/* ------------------------------------------------------------ Abstract */}
      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">Overview</p>
            <h2 className="h1">Static security benchmarks saturate, leak, and spend effort where it tells us least.</h2>
          </div>
          <div className="overview">
            <div className="prose">
              <p>
                Assessing whether coding agents <strong>recognize and repair vulnerabilities</strong> requires evaluations that reveal capability gaps and stay informative as models evolve.
                Fixed benchmarks offer fixed coverage and difficulty, while scarce vulnerable repositories and costly expert authoring limit their renewal.
              </p>
              <p>
                <strong>SecProbe</strong> treats security evaluation as adaptive measurement. It combines Item Response Theory with on-demand synthesis of repository-scale vulnerability-repair tasks:
                from observed performance it estimates agent ability, identifies where additional evidence is most informative, and either selects existing tasks or synthesizes new ones for a target CWE class, software context and difficulty.
              </p>
              <p>
                As one use case we construct 353 tasks and evaluate nine frontier models with two agent harnesses. The strongest configuration passes only <strong>28.33%</strong> of tasks.
                Against random and one-shot baselines, SecProbe reaches comparable ability estimates while requiring <strong>up to 29.5% fewer</strong> tasks.
              </p>
            </div>
            <div className="findings">
              <Finding k="28.33%" t="Best strict pass rate" d="GLM-5.3 with Terminus-2. No configuration exceeds 30%; the spread across models is nearly 20 points." />
              <Finding k="244 vs 346" t="Tasks to reach target gap" d="Adaptive synthesis hits a normalized information gap of 0.30 with 25.6% fewer tasks than random and 29.5% fewer than one-shot." />
              <Finding k="4.40 / 5" t="Expert quality rating" d="Mean expert rating across six dimensions; 92% of reviewed tasks accepted for inclusion." />
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Method */}
      <section className="section" id="method">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">Method · outer loop</p>
            <div>
              <h2 className="h1">Observe, then decide what to probe next.</h2>
              <p className="lede" style={{ marginTop: 14, maxWidth: 720 }}>After each batch, an IRT model is refit to all outcomes. The information gap points to the ability region that is under-measured; the policy then selects or synthesizes tasks for it.</p>
            </div>
          </div>
          <AdaptiveLoop />
        </div>
        <div className="wrap" style={{ marginTop: 96 }}>
          <div className="section-head">
            <p className="eyebrow">Method · inner loop</p>
            <div>
              <h2 className="h1">Five specialist agents build each task.</h2>
              <p className="lede" style={{ marginTop: 14, maxWidth: 720 }}>An orchestrator coordinates the artifacts and routes reviewer findings back for revision. Only tasks that pass deterministic validation and a containerized oracle run are released.</p>
            </div>
          </div>
          <SynthesisChain />
          <div className="row-wrap" style={{ marginTop: 28 }}>
            <Link to="/generate" className="btn btn-accent"><IconSparkle /> Synthesize a task with your own key</Link>
          </div>
        </div>
        <div className="wrap" style={{ marginTop: 96 }}>
          <div className="section-head">
            <p className="eyebrow">Explorable · 2PL-IRT</p>
            <div>
              <h2 className="h1">Where a task is informative.</h2>
            </div>
          </div>
          <IrtExplorer />
        </div>
      </section>

      {/* ------------------------------------------------------------ Results */}
      <section className="section" id="results">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">Results</p>
            <div>
              <h2 className="h1">Frontier agents remain far from reliable security repair.</h2>
              <p className="lede" style={{ marginTop: 14, maxWidth: 760 }}>
                Agents often make partial progress (mean scores 50.9–76.4 against a 46.8 vulnerable seed), but rarely block every exploit while preserving functionality.
                Harness choice moves absolute numbers, not the broad ranking.
              </p>
            </div>
          </div>
          {lb.data ? <Leaderboard data={lb.data} /> : <div className="wall-skeleton" style={{ height: 420 }} />}
          <div className="row-wrap" style={{ marginTop: 28 }}>
            <Link to="/evaluate" className="btn btn-primary"><IconPlay /> Evaluate your own agent</Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Efficiency + composition */}
      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">Efficiency</p>
            <h2 className="h1">Adaptive synthesis reaches the target with fewer tasks.</h2>
          </div>
          <Efficiency />
        </div>
        {idx.data && (
          <div className="wrap" style={{ marginTop: 96 }}>
            <div className="section-head">
              <p className="eyebrow">Composition</p>
              <h2 className="h1">Repository-scale, multi-language, cross-file.</h2>
            </div>
            <Composition index={idx.data} />
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------ Use it */}
      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">Use SecProbe</p>
            <h2 className="h1">Read the code. Run your agent. Grow the pool.</h2>
          </div>
          <div className="use-grid">
            <UseCard to="/tasks" icon={<IconCode />} title="Browse the 353 tasks" body="Open any vulnerable repository in the browser: file tree, syntax-highlighted source, public tests and the exact instruction the agent receives." cta="Open the explorer" />
            <UseCard to="/evaluate" icon={<IconPlay />} title="Evaluate a coding agent" body="Pick tasks, a harness (Terminus-2, Mini-SWE-Agent, Claude Code, Codex, OpenHands…) and any model. Runs execute on your GitHub Actions with your API key." cta="Start an evaluation" />
            <UseCard to="/generate" icon={<IconSparkle />} title="Generate a new task" body="Choose a CWE, language, software level and the difficulty vector h. The multi-agent generator builds, validates and releases an executable task." cta="Open the generator" />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Citation */}
      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">Citation</p>
            <h2 className="h2">BibTeX</h2>
          </div>
          <Bibtex />
        </div>
      </section>
    </>
  );
}

function Finding({ k, t, d }: { k: string; t: string; d: string }) {
  return (
    <div className="finding">
      <div className="finding-k num">{k}</div>
      <div className="finding-t">{t}</div>
      <div className="finding-d">{d}</div>
    </div>
  );
}

function UseCard({ to, icon, title, body, cta }: { to: string; icon: React.ReactNode; title: string; body: string; cta: string }) {
  return (
    <Link to={to} className="use-card">
      <div className="use-icon">{icon}</div>
      <div className="h3" style={{ fontSize: 18, fontFamily: "var(--serif)", fontWeight: 500 }}>{title}</div>
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>{body}</p>
      <span className="use-cta">{cta} <IconArrowRight width={15} height={15} /></span>
    </Link>
  );
}

function Efficiency() {
  const rows = [
    { name: "SecProbe (adaptive)", n: 244, accent: true },
    { name: "Random synthesis", n: 328 },
    { name: "One-shot synthesis", n: 346 },
  ];
  const max = 400;
  return (
    <div className="eff">
      <div className="eff-bars">
        {rows.map((r) => (
          <div className="eff-row" key={r.name}>
            <div className="eff-name">{r.name}</div>
            <div className="eff-track">
              <div className={`eff-bar ${r.accent ? "accent" : ""}`} style={{ width: `${(r.n / max) * 100}%` }}>
                <span className="num">{r.n}</span>
              </div>
            </div>
          </div>
        ))}
        <div className="eff-axis"><span>0</span><span>100</span><span>200</span><span>300</span><span>400</span></div>
        <p className="faint" style={{ fontSize: 12.5, margin: "8px 0 0" }}>Accepted tasks needed to reach a normalized maximum information gap of 0.30. All strategies start from the same 150 tasks and share validation.</p>
      </div>
      <div className="prose" style={{ fontSize: 17 }}>
        <p>All three strategies begin with the same 150-task batch. Guided by the information gap, SecProbe concentrates synthesis on under-measured ability regions and reaches the target after <strong>244</strong> accepted tasks, versus <strong>328</strong> for random synthesis and <strong>346</strong> for one-shot synthesis: reductions of <strong>25.6%</strong> and <strong>29.5%</strong>.</p>
        <p>Difficulty is also controllable: holding CWE and specification fixed, moving h from Easy to Hard drops GPT-5.6-Sol's pass rate from 44.0% to 13.3%, with vulnerability complexity having the largest single effect.</p>
      </div>
    </div>
  );
}

function Bars({ items, color }: { items: { label: string; n: number; color?: string; to?: string }[]; color?: string }) {
  const max = Math.max(...items.map((i) => i.n));
  const total = items.reduce((s, i) => s + i.n, 0);
  return (
    <div className="bars">
      {items.map((i) => (
        <Link className="bars-row" key={i.label} to={i.to ?? "/tasks"}>
          <span className="bars-label">{i.label}</span>
          <span className="bars-track"><span style={{ width: `${(i.n / max) * 100}%`, background: i.color ?? color ?? "var(--ink)" }} /></span>
          <span className="bars-n num">{i.n}<span className="faint"> · {((i.n / total) * 100).toFixed(1)}%</span></span>
        </Link>
      ))}
    </div>
  );
}

function Histogram({ values, bins: maxBins, label }: { values: number[]; bins: number; label: string }) {
  const lo = Math.min(...values), hi = Math.max(...values);
  const discrete = values.every(Number.isInteger) && hi - lo + 1 <= maxBins * 2;
  const bins = discrete ? hi - lo + 1 : maxBins;
  const w = discrete ? 1 : (hi - lo) / bins || 1;
  const counts = new Array(bins).fill(0);
  values.forEach((v) => counts[Math.min(bins - 1, Math.floor((v - lo) / w))]++);
  const m = Math.max(...counts);
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return (
    <div className="hist">
      <div className="hist-head"><span className="h3" style={{ fontSize: 13.5 }}>{label}</span><span className="faint mono" style={{ fontSize: 11.5 }}>median {fmt(median)} · mean {fmt(mean)}</span></div>
      <div className="hist-bars">
        {counts.map((c, i) => <span key={i} style={{ height: `${(c / m) * 100}%` }} title={discrete ? `${lo + i}: ${c} tasks` : `${fmt(lo + i * w)}–${fmt(lo + (i + 1) * w)}: ${c} tasks`} />)}
      </div>
      <div className="hist-axis mono"><span>{fmt(lo)}</span><span>{fmt(hi)}</span></div>
    </div>
  );
}
const fmt = (v: number) => (v >= 100 ? Math.round(v).toLocaleString() : v.toFixed(1).replace(/\.0$/, ""));

function Composition({ index }: { index: Index }) {
  const c = index.counts;
  const langs = Object.entries(c.languages).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ label: LANGUAGES[k as Language]?.label ?? k, n, color: LANGUAGES[k as Language]?.color, to: `/tasks?language=${k}` }));
  const cats = CATEGORIES.filter((k) => c.categories[k]).map((k) => ({ label: k, n: c.categories[k], color: categoryColor(k), to: `/tasks?category=${k}` }));
  const levels = Object.entries(c.levels).map(([k, n]) => ({ label: LEVELS[k as Level]?.label ?? k, n, to: `/tasks?level=${k}` }));
  const t = index.tasks;
  return (
    <div className="comp">
      <div className="comp-col">
        <div className="eyebrow">Implementation language</div>
        <Bars items={langs} />
        <div className="eyebrow" style={{ marginTop: 28 }}>Software level</div>
        <Bars items={levels} color="var(--ink-2)" />
      </div>
      <div className="comp-col">
        <div className="eyebrow">Security category</div>
        <Bars items={cats} />
      </div>
      <div className="comp-col comp-hists">
        <Histogram values={t.map((x) => x.loc)} bins={14} label="Source lines of code" />
        <Histogram values={t.map((x) => x.attack_paths)} bins={12} label="Attack paths per task" />
        <Histogram values={t.map((x) => x.seed_score)} bins={14} label="Vulnerable-seed grader score" />
      </div>
    </div>
  );
}

function Bibtex() {
  const [copied, setCopied] = useState(false);
  return (
    <div className="bib">
      <pre>{BIBTEX}</pre>
      <button
        className="btn btn-sm bib-copy"
        onClick={() => { navigator.clipboard?.writeText(BIBTEX).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
      >
        {copied ? <><IconCheck /> Copied</> : <><IconCopy /> Copy</>}
      </button>
    </div>
  );
}
