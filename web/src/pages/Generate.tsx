import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAsync } from "../lib/hooks";
import { CweEntry, categoryColor, loadCwes } from "../lib/data";
import { CONTROL_GROUPS, DIFFICULTY_PRESETS, GEN_STAGES } from "../lib/runner";
import { HostedConfig, HostedError, MineRow, hostedAvailable, hostedConfig, hostedMine, sessionKey, submitGeneration } from "../lib/hosted";
import { CONFIG } from "../lib/config";
import { useSession } from "../lib/store";
import { timeAgo } from "../lib/format";
import { SignInGate } from "../components/Runner";
import { Math as LatexMath } from "../components/Math";
import { IconLock, IconShield, IconSparkle } from "../components/Icons";
import "./console.css";

const LANG_OPTS = [
  { id: "agent_inferred", label: "Let the planner choose" },
  { id: "python", label: "Python" }, { id: "go", label: "Go" }, { id: "cpp", label: "C++" },
  { id: "typescript", label: "TypeScript" }, { id: "java", label: "Java" }, { id: "rust", label: "Rust" },
];
const LEVEL_OPTS = [
  { id: "agent_inferred", label: "Let the planner choose" },
  { id: "library_component", label: "Library component" },
  { id: "single_process_application", label: "Single-process application" },
  { id: "multi_service_application", label: "Multi-service application" },
];
const DIFFS = [
  { id: "easy" as const, label: "Easy", d: "≥300 LOC, 1 vulnerability, smaller test suites" },
  { id: "medium" as const, label: "Medium", d: "≥600 LOC, 2 vulnerabilities × 2 attack paths" },
  { id: "hard" as const, label: "Hard", d: "≥1,000 LOC, 3+ vulnerabilities; the paper's setting" },
];

export default function Generate() {
  return (
    <div className="wrap console">
      <header className="console-head">
        <p className="eyebrow">Generate</p>
        <h1 className="h1">Synthesize a new vulnerability-repair task.</h1>
        <p className="lede" style={{ maxWidth: 740, marginTop: 12 }}>
          Specify a CWE class <LatexMath tex="c" />, a software context <LatexMath tex="s" /> and the difficulty vector <LatexMath tex="h" />. Five specialist agents research, design, build, test and review a repository-scale task;
          it is released only if deterministic validation and a containerized oracle run pass.
        </p>
      </header>
      <HostedGate />
    </div>
  );
}

function HostedGate() {
  const cfg = useAsync(() => (hostedAvailable() ? hostedConfig() : Promise.reject(new Error("not configured"))), []);
  if (cfg.loading) return <div className="row muted"><div className="spinner" /> Connecting to the generation service…</div>;
  if (cfg.error || !cfg.data) {
    return <div className="alert alert-warn">The hosted generation service is not reachable right now. Browsing and evaluating tasks still work.</div>;
  }
  if (!cfg.data.enabled || !cfg.data.public_key) {
    return <div className="alert alert-warn">Hosted generation is temporarily paused by the SecProbe team. Please check back later.</div>;
  }
  const config = cfg.data;
  return (
    <SignInGate why={<>Generation runs on the SecProbe team's infrastructure; GitHub sign-in only identifies you for the fair-use limit of {config.user_daily_limit} generations per day. No repository is created.</>}>
      {(_gh, login) => <GenConsole login={login} config={config} />}
    </SignInGate>
  );
}

function GenConsole({ login, config }: { login: string; config: HostedConfig }) {
  const { token, signOut } = useSession();
  const cwes = useAsync(loadCwes, []);
  const nav = useNavigate();
  const [cwe, setCwe] = useState("CWE-918");
  const [language, setLanguage] = useState("python");
  const [level, setLevel] = useState("single_process_application");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("hard");
  const [controls, setControls] = useState<Record<string, number>>(DIFFICULTY_PRESETS.hard);
  const [custom, setCustom] = useState(false);
  const [model, setModel] = useState("gpt-5.6-luna");
  const [effort, setEffort] = useState<"low" | "medium" | "high">("medium");
  const [research, setResearch] = useState(true);
  const [gate, setGate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [openaiKey, setOpenaiKey] = useState(sessionKey.get);
  const [rememberKey, setRememberKey] = useState(Boolean(sessionKey.get()));

  useEffect(() => { if (!custom) setControls(DIFFICULTY_PRESETS[difficulty]); }, [difficulty, custom]);

  const hasKey = openaiKey.length > 20;
  const validCwe = /^CWE-\d+$/.test(cwe);
  const existing = cwes.data?.find((c) => c.id === cwe);

  const launch = async () => {
    setBusy(true); setErr(null);
    try {
      const rid = await submitGeneration(token!, config.public_key!, openaiKey, {
        cwe, language, software_level: level, difficulty, model, effort, online_research: research, release_gate: gate,
        // Presets are applied by the generator; send explicit overrides only for a customized h.
        controls: custom ? { ...controls, max_mutations: Math.max(controls.max_mutations ?? 6, controls.min_mutations ?? 3) } : {},
      });
      sessionKey.set(rememberKey ? openaiKey : null);
      nav(`/generate/${rid}`);
    } catch (e) {
      if (e instanceof HostedError && e.status === 429) setErr(`${e.message} ${e.retryAfter ? `Try again in about ${Math.max(1, Math.ceil(e.retryAfter / 3600))} h.` : ""}`);
      else setErr(e instanceof Error ? e.message : String(e));
    }
    finally { setBusy(false); }
  };

  return (
    <div className="stack" style={{ gap: 28 }}>
      <div className="runner-bar row-wrap" style={{ gap: 14 }}>
        <span className="live-dot" style={{ animation: "none", background: "var(--ok)" }} />
        <span style={{ fontSize: 13.5 }}>Signed in as <b>{login}</b> · hosted generation · {config.user_daily_limit} per day</span>
        <span className="spacer" />
        <button className="btn btn-sm btn-ghost" onClick={signOut}>Sign out</button>
      </div>
      <div className="gen-grid">
        <div className="stack" style={{ gap: 28 }}>
          <section className="cfg">
            <div className="cfg-head"><span className="cfg-n"><LatexMath tex="c" /></span><h2 className="h3">Vulnerability class</h2></div>
            <CwePicker value={cwe} onChange={setCwe} options={cwes.data ?? []} />
            <div className="hint" style={{ marginTop: 8 }}>
              {existing ? (
                <>{existing.name} · <span style={{ color: categoryColor(existing.category) }}>{existing.category}</span> · <Link to={`/tasks?cwe=${cwe}`}>{existing.tasks} existing task{existing.tasks === 1 ? "" : "s"} in the pool</Link></>
              ) : validCwe ? <>Not in the current pool; a new CWE extends coverage.</> : <>Use the form CWE-&lt;number&gt;.</>}
            </div>
          </section>

          <section className="cfg">
            <div className="cfg-head"><span className="cfg-n"><LatexMath tex="s" /></span><h2 className="h3">Software context</h2></div>
            <div className="settings-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div className="field">
                <label>Implementation language</label>
                <select className="select" value={language} onChange={(e) => setLanguage(e.target.value)}>{LANG_OPTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>
              </div>
              <div className="field">
                <label>Software level</label>
                <select className="select" value={level} onChange={(e) => setLevel(e.target.value)}>{LEVEL_OPTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>
              </div>
            </div>
          </section>

          <section className="cfg">
            <div className="cfg-head">
              <span className="cfg-n"><LatexMath tex="h" /></span><h2 className="h3">Difficulty</h2>
              <span className="spacer" />
              <label className="row hint" style={{ gap: 8 }}><input type="checkbox" checked={custom} onChange={(e) => setCustom(e.target.checked)} /> Customize <LatexMath tex="h" /></label>
            </div>
            <div className="diff-pick">
              {DIFFS.map((d) => (
                <button key={d.id} className={`diff-opt ${difficulty === d.id ? "on" : ""}`} onClick={() => { setDifficulty(d.id); setCustom(false); }} aria-pressed={difficulty === d.id}>
                  <b>{d.label}</b><span>{d.d}</span>
                </button>
              ))}
            </div>
            {custom && (
              <div className="ctl-groups fade-in" style={{ marginTop: 14 }}>
                {CONTROL_GROUPS.map((g) => (
                  <div className="ctl-group" key={g.key}>
                    <div className="ctl-group-head"><span className="h3" style={{ fontSize: 13.5 }}>{g.label}</span><span className="faint" style={{ fontSize: 11.5 }}><LatexMath tex={`h_{\\mathrm{${g.key}}}`} /></span></div>
                    {g.fields.map((f) => (
                      <label className="ctl-row" key={f.key}>
                        <span className="muted">{f.label}</span>
                        <input className="input num" type="number" min={f.min} max={f.max} step={f.step ?? 1} value={controls[f.key] ?? f.min}
                          onChange={(e) => setControls({ ...controls, [f.key]: Math.max(f.min, Math.min(f.max, +e.target.value || f.min)) })} />
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="cfg">
            <div className="cfg-head"><span className="cfg-n">⚙</span><h2 className="h3">Generator</h2></div>
            <div className="field" style={{ marginBottom: 14 }}>
              <label htmlFor="okey">Your OpenAI API key</label>
              <input id="okey" className="input mono" type="password" autoComplete="off" spellCheck={false} placeholder="sk-…" value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value.trim())} />
              <div className="hint">
                <IconShield width={12} height={12} style={{ display: "inline", verticalAlign: -1 }} /> Sealed in your browser with the generator's public key; it is decrypted only inside the generation job for this one run and is never stored or logged.
                The specialist agents use the OpenAI Agents SDK, so usage is billed to this key.
              </div>
              <label className="row hint" style={{ gap: 8 }}><input type="checkbox" checked={rememberKey} onChange={(e) => setRememberKey(e.target.checked)} /> Keep it in this tab for my next generation</label>
            </div>
            <div className="settings-grid">
              <div className="field">
                <label>Specialist model (OpenAI)</label>
                <input className="input mono" value={model} onChange={(e) => setModel(e.target.value.trim())} spellCheck={false} />
              </div>
              <div className="field">
                <label>Reasoning effort</label>
                <select className="select" value={effort} onChange={(e) => setEffort(e.target.value as typeof effort)}>{["low", "medium", "high"].map((x) => <option key={x}>{x}</option>)}</select>
              </div>
            </div>
            <div className="stack" style={{ gap: 8, marginTop: 14 }}>
              <label className="row" style={{ gap: 8, fontSize: 14 }}><input type="checkbox" checked={research} onChange={(e) => setResearch(e.target.checked)} /> Online security research <span className="hint">(the Researcher consults public sources)</span></label>
              <label className="row" style={{ gap: 8, fontSize: 14 }}><input type="checkbox" checked={gate} onChange={(e) => setGate(e.target.checked)} /> Harbor release gate <span className="hint">(certify with an oracle run in Docker; recommended)</span></label>
            </div>
          </section>
        </div>

        <aside className="summary">
          <div className="summary-card">
            <div className="eyebrow" style={{ marginBottom: 12 }}>Configuration</div>
            <div style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 14, color: "var(--ink-2)" }}>
              <LatexMath tex={`x \\sim \\mathcal{D}(\\text{${cwe}}, s, h)`} />
            </div>
            <dl className="summary-kv">
              <div><dt>Language</dt><dd>{LANG_OPTS.find((o) => o.id === language)?.label}</dd></div>
              <div><dt>Level</dt><dd>{LEVEL_OPTS.find((o) => o.id === level)?.label}</dd></div>
              <div><dt>Difficulty</dt><dd>{custom ? "custom" : difficulty}</dd></div>
              <div><dt>Model</dt><dd className="mono" style={{ fontSize: 12.5 }}>{model} · {effort}</dd></div>
              <div><dt>Typical time</dt><dd title="Median 0.5 h, 90th percentile 1.1 h across the 353 released tasks, plus container builds">≈ 30–70 min</dd></div>
            </dl>
            <ol className="hint" style={{ paddingLeft: 18, margin: "14px 0 16px", lineHeight: 1.7 }}>
              {GEN_STAGES.map((s) => <li key={s.key}>{s.label}</li>)}
            </ol>
            {err && <div className="alert alert-err" style={{ marginBottom: 12 }}>{err}</div>}
            <button className="btn btn-accent" style={{ width: "100%", justifyContent: "center", height: 44 }} disabled={busy || !validCwe || !hasKey || !model || !token} onClick={launch}>
              {busy ? <div className="spinner" /> : <><IconSparkle /> Generate task</>}
            </button>
            <p className="hint" style={{ margin: "12px 0 0" }}><IconLock width={11} height={11} style={{ display: "inline", verticalAlign: -1 }} /> Generated tasks are stored in the private <a href={`https://github.com/${CONFIG.generatedRepo}`} target="_blank" rel="noreferrer">task pool</a> under your GitHub name. The generator source stays private.</p>
          </div>
        </aside>
      </div>
      <MyGenerations token={token!} />
    </div>
  );
}

function CwePicker({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: CweEntry[] }) {
  const [q, setQ] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const list = useMemo(() => {
    const n = q.trim().toLowerCase().replace(/^cwe-?/, "");
    const scored = options.filter((o) => !n || o.id.toLowerCase().includes(n) || o.name.toLowerCase().includes(n));
    const custom = /^\d+$/.test(n) && !options.some((o) => o.id === `CWE-${n}`) ? [{ id: `CWE-${n}`, name: "Custom CWE (not yet in the pool)", category: "" as never, tasks: 0 }] : [];
    return [...custom, ...scored].slice(0, 60);
  }, [q, options]);

  const choose = (id: string) => { onChange(id); setQ(id); setOpen(false); };

  return (
    <div className="combo" ref={ref}>
      <input className="input" value={q} placeholder="Search CWE id or name, e.g. 918 or SSRF"
        onFocus={() => { setOpen(true); setQ(""); }}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
        onBlur={() => setTimeout(() => { if (!open) setQ(value); }, 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { setActive((a) => Math.min(a + 1, list.length - 1)); e.preventDefault(); }
          if (e.key === "ArrowUp") { setActive((a) => Math.max(a - 1, 0)); e.preventDefault(); }
          if (e.key === "Enter" && list[active]) { choose(list[active].id); e.preventDefault(); }
          if (e.key === "Escape") { setOpen(false); setQ(value); }
        }}
        role="combobox" aria-expanded={open} aria-label="CWE" />
      {open && (
        <div className="combo-list" role="listbox">
          {list.map((o, i) => (
            <button key={o.id} className={`combo-item ${i === active ? "active" : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(o.id)} role="option" aria-selected={o.id === value}>
              <span className="mono" style={{ fontSize: 12.5 }}>{o.id}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.name}</span>
              <span className="faint num" style={{ fontSize: 11.5 }}>{o.tasks ? `${o.tasks} task${o.tasks > 1 ? "s" : ""}` : "new"}</span>
            </button>
          ))}
          {!list.length && <div className="faint" style={{ padding: 10, fontSize: 13 }}>Type a number to use any CWE.</div>}
        </div>
      )}
    </div>
  );
}

function MyGenerations({ token }: { token: string }) {
  const [rows, setRows] = useState<MineRow[] | null>(null);
  useEffect(() => { hostedMine(token).then(setRows).catch(() => setRows([])); }, [token]);
  if (!rows?.length) return null;
  return (
    <section>
      <h2 className="h3" style={{ marginBottom: 10 }}>Your generations</h2>
      <div className="card">
        <table className="table">
          <tbody>
            {rows.map((r) => (
              <tr key={r.request_id}>
                <td><Link to={`/generate/${r.request_id}`} className="mono" style={{ fontSize: 12.5 }}>{r.request_id}</Link></td>
                <td>{[r.summary?.cwe, r.summary?.language, r.summary?.difficulty].filter(Boolean).join(" · ")}</td>
                <td className="faint" style={{ fontSize: 12.5, textAlign: "right" }}>{timeAgo(r.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
