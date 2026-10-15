import { useState } from "react";
import { Link } from "react-router-dom";
import { CONFIG } from "../lib/config";
import { Logo } from "../components/Layout";
import { AdaptiveLoop, IrtExplorer, SynthesisChain } from "../components/Method";
import { Math } from "../components/Math";
import { PaperFigure } from "../components/PaperFigure";
import { IconArrowRight, IconCheck, IconCode, IconCopy, IconDatabase, IconLock, IconPaper, IconPlay, IconSparkle } from "../components/Icons";
import "./home.css";

const AUTHORS: [string, string, boolean?][] = [
  ["Xiaonan Luo", "1,2", true], ["Yue Huang", "1,2", true], ["Kehan Guo", "1"], ["Ping He", "3"], ["Chuan Zou", "4"],
  ["Chujie Gao", "1"], ["Lichi Li", "2"], ["Yuchen Ma", "5"], ["Zhangchen Xu", "2,6"], ["Zichen Chen", "2,7"],
  ["Yufei Han", "8"], ["Xiangliang Zhang", "1"],
];
const AFFILS = ["University of Notre Dame", "Bake AI", "Vanderbilt University", "University of Pennsylvania", "LMU Munich", "University of Washington", "Stanford University", "Inria"];

const INSTITUTIONS = [
  { name: "University of Notre Dame", file: "notre-dame.png", url: "https://www.nd.edu/" },
  { name: "Bake AI", file: "bake-ai.svg", url: "https://www.bakeai.inc/" },
  { name: "Vanderbilt University", file: "vanderbilt.svg", url: "https://www.vanderbilt.edu/" },
  { name: "University of Pennsylvania", file: "penn.png", url: "https://www.upenn.edu/" },
  { name: "LMU Munich", file: "lmu.svg", url: "https://www.lmu.de/" },
  { name: "University of Washington", file: "washington.png", url: "https://www.washington.edu/" },
  { name: "Stanford University", file: "stanford.png", url: "https://www.stanford.edu/" },
  { name: "Inria", file: "inria.svg", url: "https://www.inria.fr/" },
];

const BIBTEX = `@article{luo2026secprobe,
  title   = {SecProbe: Adaptive Evaluation of Coding Agents on Cybersecurity Vulnerabilities},
  author  = {Luo, Xiaonan and Huang, Yue and Guo, Kehan and He, Ping and Zou, Chuan and Gao, Chujie and
             Li, Lichi and Ma, Yuchen and Xu, Zhangchen and Chen, Zichen and Han, Yufei and Zhang, Xiangliang},
  journal = {arXiv preprint arXiv:2609.33763},
  year    = {2026}
}`;

export default function Home() {
  return (
    <>
      {/* ------------------------------------------------------------ Hero */}
      <section className="hero">
        <div className="wrap">
          <p className="eyebrow fade-in">Research · Agent evaluation · Code security</p>
          <div className="hero-identity fade-in"><Logo size={84} /><h1 className="display">SecProbe</h1></div>
          <p className="hero-sub fade-in">Adaptive evaluation of coding agents on cybersecurity vulnerabilities</p>

          <div className="authors fade-in">
            {AUTHORS.map(([n, a, eq]) => (
              <span key={n}>{n}<sup>{a}{eq ? "*" : ""}</sup></span>
            ))}
          </div>
          <div className="affils fade-in">
            {AFFILS.map((a, i) => <span key={a}><sup>{i + 1}</sup>{a}</span>)}
            <span><sup>*</sup>Equal contribution</span>
          </div>

          <div className="affiliation-logos" aria-label="Author affiliations">
            {INSTITUTIONS.map(({ name, file, url }) => (
              <a key={name} href={url} target="_blank" rel="noreferrer" className={`school-link${file === "penn.png" ? " school-link-penn" : file === "bake-ai.svg" ? " school-link-bake" : ""}`} aria-label={name}>
                <img src={`${import.meta.env.BASE_URL}affiliations/${file}`} alt={name} width={180} height={64} />
              </a>
            ))}
          </div>

          <div className="row-wrap hero-ctas fade-in">
            <a className="btn btn-primary" href={CONFIG.paperUrl} target="_blank" rel="noreferrer"><IconPaper /> Paper</a>
            <Link className="btn" to="/access?resource=code"><IconCode /> Code <IconLock /></Link>
            <Link className="btn" to="/access?resource=data"><IconDatabase /> Data <IconLock /></Link>
            <span className="hero-sep" />
            <Link className="btn btn-ghost" to="/access?resource=tasks">Task details <IconLock /></Link>
          </div>
        </div>

        <div className="wrap">
          <p className="hero-access-note"><IconLock width={14} height={14} /><span>This page shares the paper overview. Task details, research code and data require approval. <Link to="/access">Request access <IconArrowRight width={14} height={14} /></Link></span></p>
        </div>

        <div className="wrap">
          <dl className="stats">
            <div><dt>Tasks</dt><dd className="num">353</dd></div>
            <div><dt>CWE types</dt><dd className="num">151</dd></div>
            <div><dt>Languages</dt><dd className="num">6</dd></div>
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
          <PaperFigure file="framework-overview.svg" number={1} title="The SecProbe framework" caption="Adaptive evaluation identifies where evidence is missing, then selects tasks or invokes five specialist agents to synthesize new ones." width={1140} height={411} />
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
            <Link to="/generate" className="btn btn-accent"><IconSparkle /> Synthesize a task with your own key <IconLock /></Link>
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
          <PaperFigure file="agent-performance.png" number={8} title="How frontier agents perform" caption="Pass rates and mean scores for nine models with two agent harnesses. The strongest configuration reaches a strict pass rate of 28.33%." width={1876} height={765} />
          <div className="row-wrap" style={{ marginTop: 28 }}>
            <a className="btn btn-primary" href={CONFIG.pdfUrl} target="_blank" rel="noreferrer"><IconPaper /> Read the full results</a>
            <Link to="/evaluate" className="btn"><IconPlay /> Evaluate your own agent <IconLock /></Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Efficiency */}
      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">Efficiency</p>
            <h2 className="h1">Adaptive synthesis reaches the target with fewer tasks.</h2>
          </div>
          <PaperFigure file="adaptive-efficiency.svg" number={9} title="More information from fewer evaluations" caption="SecProbe reaches the normalized information-gap target of 0.30 after 244 accepted tasks, compared with 328 for random synthesis and 346 for one-shot synthesis." width={1050} height={344} />
          <Efficiency />
        </div>
      </section>

      {/* ------------------------------------------------------------ Use it */}
      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">Use SecProbe</p>
            <div><h2 className="h1">Request access to SecProbe resources.</h2><p className="lede" style={{ marginTop: 14 }}>The authors review requests before sharing task details, research code or data.</p></div>
          </div>
          <div className="use-grid">
            <UseCard to="/access?resource=tasks" icon={<IconLock />} title="Task details" body="Request access to the task explorer, including task instructions, repository source and tests." cta="Request task access" />
            <UseCard to="/access?resource=code" icon={<IconCode />} title="Research code" body="Request access to the SecProbe implementation for research and reproduction." cta="Request code access" />
            <UseCard to="/access?resource=data" icon={<IconDatabase />} title="Benchmark data" body="Request approval to download the benchmark and executable task bundles." cta="Request data access" />
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
          <p className="paper-figure-attribution">Figures 1, 8 and 9 from <a href={CONFIG.paperUrl} target="_blank" rel="noreferrer">Luo et al. (2026)</a>, shared under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>.</p>
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
      <div className="h3" style={{ fontSize: 18, fontFamily: "var(--sans)", fontWeight: 500 }}>{title}</div>
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>{body}</p>
      <span className="use-cta">{cta} <IconArrowRight width={15} height={15} /></span>
    </Link>
  );
}

function Efficiency() {
  return (
    <div className="eff-summary prose">
      <p>All three strategies begin with the same 150-task batch. Guided by the information gap, SecProbe concentrates synthesis on under-measured ability regions and reaches the target after <strong>244</strong> accepted tasks, versus <strong>328</strong> for random synthesis and <strong>346</strong> for one-shot synthesis: reductions of <strong>25.6%</strong> and <strong>29.5%</strong>.</p>
      <p>Difficulty is also controllable: holding CWE and specification fixed, moving <Math tex="h" /> from Easy to Hard drops GPT-5.6-Sol's pass rate from 44.0% to 13.3%, with vulnerability complexity having the largest single effect.</p>
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
