import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAsync, useDebounced } from "../lib/hooks";
import { CATEGORIES, LANGUAGES, LEVELS, Language, Level, TaskSummary, categoryColor, loadIndex } from "../lib/data";
import { useSession } from "../lib/store";
import { IconArrowRight, IconCheck, IconPlay, IconSearch, IconX } from "../components/Icons";
import "./tasks.css";

type SortKey = "id" | "title" | "loc" | "attack_paths" | "seed_score" | "cwe";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "id", label: "Task ID" },
  { key: "cwe", label: "CWE" },
  { key: "title", label: "Title" },
  { key: "loc", label: "Lines of code" },
  { key: "attack_paths", label: "Attack paths" },
  { key: "seed_score", label: "Seed score (low = more broken)" },
];

const listParam = (p: URLSearchParams, k: string) => (p.get(k) ? p.get(k)!.split(",").filter(Boolean) : []);

export default function Tasks() {
  const idx = useAsync(loadIndex, []);
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const dq = useDebounced(q, 120);
  const cats = listParam(params, "category");
  const langs = listParam(params, "language");
  const levels = listParam(params, "level");
  const cwe = params.get("cwe") ?? "";
  const sort = (params.get("sort") as SortKey) || "id";
  const { selection, toggle, setSelection } = useSession();
  const nav = useNavigate();
  const [showFilters, setShowFilters] = useState(false);

  const update = (k: string, v: string[] | string | null) => {
    const p = new URLSearchParams(params);
    const val = Array.isArray(v) ? v.join(",") : v;
    if (!val) p.delete(k); else p.set(k, val);
    setParams(p, { replace: true });
  };
  const flip = (k: string, cur: string[], v: string) => update(k, cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]);

  const tasks = idx.data?.tasks ?? [];
  const cweOptions = useMemo(() => {
    const m = new Map<string, { name: string; n: number }>();
    tasks.forEach((t) => { const e = m.get(t.cwe) ?? { name: t.cwe_name, n: 0 }; e.n++; m.set(t.cwe, e); });
    return [...m.entries()].sort((a, b) => +a[0].slice(4) - +b[0].slice(4));
  }, [tasks]);

  const filtered = useMemo(() => {
    const needle = dq.trim().toLowerCase();
    const out = tasks.filter((t) =>
      (!cats.length || cats.includes(t.category)) &&
      (!langs.length || langs.includes(t.language)) &&
      (!levels.length || levels.includes(t.level)) &&
      (!cwe || t.cwe === cwe) &&
      (!needle || `${t.id} ${t.title} ${t.subtitle} ${t.cwe} ${t.cwe_name} ${t.summary}`.toLowerCase().includes(needle)),
    );
    const cmp: Record<SortKey, (a: TaskSummary, b: TaskSummary) => number> = {
      id: (a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }),
      title: (a, b) => a.title.localeCompare(b.title),
      cwe: (a, b) => +a.cwe.slice(4) - +b.cwe.slice(4),
      loc: (a, b) => b.loc - a.loc,
      attack_paths: (a, b) => b.attack_paths - a.attack_paths,
      seed_score: (a, b) => a.seed_score - b.seed_score,
    };
    return out.sort(cmp[sort]);
  }, [tasks, dq, cats.join(), langs.join(), levels.join(), cwe, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const facet = (key: "category" | "language" | "level", v: string) => tasks.filter((t) => t[key] === v).length;
  const anyFilter = cats.length || langs.length || levels.length || cwe || q;
  const filteredIds = filtered.map((t) => t.id);
  const allFilteredSelected = filtered.length > 0 && filtered.every((t) => selection.includes(t.id));

  const pickRandom = (n: number) => {
    const pool = [...filteredIds];
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    setSelection(pool.slice(0, n));
  };

  return (
    <div className="wrap tasks-page">
      <header className="tasks-head">
        <p className="eyebrow">Task explorer</p>
        <h1 className="h1">353 vulnerable repositories, open to read.</h1>
        <p className="lede" style={{ maxWidth: 720, marginTop: 12 }}>
          Each task is a working application with seeded vulnerabilities of one CWE class. Agents get the repository and its public tests;
          exploit tests and the reference patch stay hidden.
        </p>
      </header>

      <div className="tasks-layout">
        <button className="btn btn-sm filters-toggle" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
          {showFilters ? "Hide filters" : `Filters${cats.length + langs.length + levels.length + (cwe ? 1 : 0) ? ` · ${cats.length + langs.length + levels.length + (cwe ? 1 : 0)} active` : ""}`}
        </button>
        <aside className={`filters ${showFilters ? "open" : ""}`} aria-label="Filters">
          <div className="search">
            <IconSearch width={16} height={16} />
            <input className="input" placeholder="Search title, CWE, description…" value={q}
              onChange={(e) => { setQ(e.target.value); update("q", e.target.value); }} aria-label="Search tasks" />
          </div>

          <FilterGroup title="Category">
            {CATEGORIES.map((c) => (
              <FacetRow key={c} on={cats.includes(c)} onClick={() => flip("category", cats, c)} swatch={categoryColor(c)} label={c} n={facet("category", c)} />
            ))}
          </FilterGroup>
          <FilterGroup title="Language">
            {(Object.keys(LANGUAGES) as Language[]).filter((l) => facet("language", l) > 0).map((l) => (
              <FacetRow key={l} on={langs.includes(l)} onClick={() => flip("language", langs, l)} swatch={LANGUAGES[l].color} label={LANGUAGES[l].label} n={facet("language", l)} />
            ))}
          </FilterGroup>
          <FilterGroup title="Software level">
            {(Object.keys(LEVELS) as Level[]).map((l) => (
              <FacetRow key={l} on={levels.includes(l)} onClick={() => flip("level", levels, l)} label={LEVELS[l].label} n={facet("level", l)} />
            ))}
          </FilterGroup>
          <FilterGroup title="CWE">
            <select className="select" value={cwe} onChange={(e) => update("cwe", e.target.value)} aria-label="CWE">
              <option value="">All {cweOptions.length} CWE types</option>
              {cweOptions.map(([id, v]) => <option key={id} value={id}>{id} · {v.name.slice(0, 48)}{v.name.length > 48 ? "…" : ""} ({v.n})</option>)}
            </select>
          </FilterGroup>
          {anyFilter ? (
            <button className="btn btn-sm btn-ghost" onClick={() => { setQ(""); setParams({}, { replace: true }); }}><IconX /> Clear filters</button>
          ) : null}
        </aside>

        <section className="results" aria-live="polite">
          <div className="results-bar">
            <span className="muted num" style={{ fontSize: 13.5 }}>
              <b style={{ color: "var(--ink)" }}>{filtered.length}</b> of {tasks.length} tasks
            </span>
            <span className="spacer" />
            <button className="btn btn-sm btn-ghost" disabled={!filtered.length}
              onClick={() => setSelection(allFilteredSelected ? selection.filter((id) => !filteredIds.includes(id)) : [...selection, ...filteredIds])}>
              {allFilteredSelected ? "Deselect shown" : "Select shown"}
            </button>
            <button className="btn btn-sm btn-ghost" disabled={filtered.length < 2} onClick={() => pickRandom(10)}>Random 10</button>
            <select className="select" style={{ width: "auto", height: 30, fontSize: 13 }} value={sort} onChange={(e) => update("sort", e.target.value === "id" ? null : e.target.value)} aria-label="Sort">
              {SORTS.map((s) => <option key={s.key} value={s.key}>Sort: {s.label}</option>)}
            </select>
          </div>

          {idx.loading && <div className="list-skeleton">{Array.from({ length: 8 }, (_, i) => <div key={i} />)}</div>}
          {idx.error && <p className="muted">Could not load the task index: {idx.error.message}</p>}

          <ul className="task-list">
            {filtered.map((t) => (
              <TaskRow key={t.id} t={t} selected={selection.includes(t.id)} onToggle={() => toggle(t.id)} />
            ))}
          </ul>
          {idx.data && !filtered.length && (
            <div className="empty">
              <p className="h3">No tasks match.</p>
              <p className="muted">Try clearing a filter, or <Link to="/generate">synthesize a task</Link> for exactly this combination.</p>
            </div>
          )}
        </section>
      </div>

      {selection.length > 0 && (
        <div className="sel-bar fade-in" role="region" aria-label="Evaluation set">
          <span className="num"><b>{selection.length}</b> task{selection.length > 1 ? "s" : ""} in your evaluation set</span>
          <span className="spacer" />
          <button className="btn btn-sm btn-ghost sel-clear" onClick={() => setSelection([])}>Clear</button>
          <button className="btn btn-sm btn-accent" onClick={() => nav("/evaluate")}><IconPlay /> Evaluate</button>
        </div>
      )}
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="fgroup">
      <div className="fgroup-title">{title}</div>
      {children}
    </div>
  );
}

function FacetRow({ on, onClick, label, n, swatch }: { on: boolean; onClick: () => void; label: string; n: number; swatch?: string }) {
  return (
    <button className={`facet ${on ? "on" : ""}`} onClick={onClick} aria-pressed={on}>
      <span className="facet-box">{on && <IconCheck width={11} height={11} />}</span>
      {swatch && <span className="facet-sw" style={{ background: swatch }} />}
      <span className="facet-label">{label}</span>
      <span className="facet-n num">{n}</span>
    </button>
  );
}

function TaskRow({ t, selected, onToggle }: { t: TaskSummary; selected: boolean; onToggle: () => void }) {
  return (
    <li className={`task-row ${selected ? "sel" : ""}`}>
      <label className="task-check" title={selected ? "Remove from evaluation set" : "Add to evaluation set"}>
        <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Select ${t.title}`} />
      </label>
      <Link to={`/tasks/${t.id}`} className="task-main">
        <div className="task-top">
          <span className="task-cat" style={{ background: categoryColor(t.category) }} title={t.category} />
          <span className="task-title">{t.title}</span>
          {t.subtitle && <span className="task-sub">{t.subtitle}</span>}
        </div>
        <div className="task-meta">
          <span className="chip chip-mono">{t.cwe}</span>
          <span className="task-cwe-name">{t.cwe_name}</span>
        </div>
        <div className="task-facts num">
          <span><i className="dot" style={{ background: LANGUAGES[t.language]?.color }} />{LANGUAGES[t.language]?.label}</span>
          <span>{LEVELS[t.level]?.short}</span>
          <span>{t.loc.toLocaleString()} LOC</span>
          <span>{t.files} files</span>
          <span>{t.vulns} vulns · {t.attack_paths} paths</span>
          <span className="mono faint">{t.id}</span>
        </div>
      </Link>
      <div className="task-score" title="Grader score of the vulnerable seed before repair (100 = fully repaired)">
        <div className="seed-ring" style={{ ["--p" as string]: t.seed_score }}><span className="num">{Math.round(t.seed_score)}</span></div>
        <IconArrowRight width={16} height={16} className="task-go" />
      </div>
    </li>
  );
}
