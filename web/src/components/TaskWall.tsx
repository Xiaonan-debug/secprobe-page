// The 353-task mosaic: one cell per task, grouped by security category.
import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CATEGORIES, LANGUAGES, LEVELS, TaskSummary, categoryColor } from "../lib/data";
import "./taskwall.css";

export function TaskWall({ tasks }: { tasks: TaskSummary[] }) {
  const nav = useNavigate();
  const [hover, setHover] = useState<{ t: TaskSummary; x: number; y: number } | null>(null);
  const [focusCat, setFocusCat] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const ordered = useMemo(() => {
    const rank = (c: string) => { const i = CATEGORIES.indexOf(c as never); return i < 0 ? 99 : i; };
    return [...tasks].sort((a, b) => rank(a.category) - rank(b.category) || a.cwe.localeCompare(b.cwe, undefined, { numeric: true }) || a.id.localeCompare(b.id));
  }, [tasks]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of tasks) m[t.category] = (m[t.category] || 0) + 1;
    return m;
  }, [tasks]);

  const onMove = (t: TaskSummary, e: React.MouseEvent) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setHover({ t, x: e.clientX - r.left, y: e.clientY - r.top });
  };

  return (
    <div className="wall-wrap">
      <div className="wall" ref={box} onMouseLeave={() => setHover(null)} role="list" aria-label={`${tasks.length} tasks`}>
        {ordered.map((t) => (
          <button
            key={t.id}
            role="listitem"
            className={`wall-cell ${focusCat && focusCat !== t.category ? "dim" : ""}`}
            style={{ background: categoryColor(t.category) }}
            aria-label={`${t.title} — ${t.cwe}, ${LANGUAGES[t.language]?.label}`}
            onMouseMove={(e) => onMove(t, e)}
            onFocus={(e) => { const r = (e.target as HTMLElement).getBoundingClientRect(); const b = box.current!.getBoundingClientRect(); setHover({ t, x: r.left - b.left + 8, y: r.top - b.top }); }}
            onBlur={() => setHover(null)}
            onClick={() => nav(`/tasks/${t.id}`)}
          />
        ))}
        {hover && (
          <div
            className="wall-tip"
            style={{
              left: Math.min(Math.max(hover.x, 120), (box.current?.clientWidth ?? 400) - 120),
              top: hover.y,
            }}
          >
            <div className="row" style={{ gap: 6, marginBottom: 6 }}>
              <span className="chip chip-mono" style={{ height: 20 }}>{hover.t.cwe}</span>
              <span className="faint" style={{ fontSize: 11.5 }}>{LANGUAGES[hover.t.language]?.label} · {LEVELS[hover.t.level]?.short}</span>
            </div>
            <div className="wall-tip-title">{hover.t.title}</div>
            {hover.t.subtitle && <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.4 }}>{hover.t.subtitle}</div>}
            <div className="wall-tip-stats num">
              <span><b>{hover.t.loc.toLocaleString()}</b> LOC</span>
              <span><b>{hover.t.attack_paths}</b> attack paths</span>
              <span><b>{hover.t.seed_score.toFixed(1)}</b> seed score</span>
            </div>
          </div>
        )}
      </div>
      <div className="wall-legend" role="group" aria-label="Filter by category">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            className={`wall-key ${focusCat === c ? "on" : ""}`}
            onMouseEnter={() => setFocusCat(c)}
            onMouseLeave={() => setFocusCat(null)}
            onFocus={() => setFocusCat(c)}
            onBlur={() => setFocusCat(null)}
            onClick={() => nav(`/tasks?category=${c}`)}
          >
            <span className="sw" style={{ background: categoryColor(c) }} />
            {c}
            <span className="faint num">{counts[c] ?? 0}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
