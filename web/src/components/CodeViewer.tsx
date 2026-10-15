// Repository browser: collapsible file tree + highlighted source with line anchors.
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { TreeEntry } from "../lib/data";
import { Finding, SEVERITY, toolLabel } from "../lib/analysis";
import { escapeHtml, highlightLines } from "../lib/highlight";
import { renderMarkdown } from "../lib/markdown";
import { fmtBytes } from "../lib/format";
import { IconCheck, IconChevron, IconCopy, IconFile, IconFolder, IconSearch } from "./Icons";
import "./codeviewer.css";

interface Node { name: string; path: string; dir: boolean; children: Node[]; entry?: TreeEntry }

function buildTree(entries: TreeEntry[]): Node {
  const root: Node = { name: "", path: "", dir: true, children: [] };
  for (const e of entries) {
    const parts = e.path.split("/");
    let cur = root;
    parts.forEach((p, i) => {
      const path = parts.slice(0, i + 1).join("/");
      const last = i === parts.length - 1;
      let next = cur.children.find((c) => c.name === p && c.dir === !last);
      if (!next) {
        next = { name: p, path, dir: !last, children: [], entry: last ? e : undefined };
        cur.children.push(next);
      }
      cur = next;
    });
  }
  const sort = (n: Node) => {
    n.children.sort((a, b) => (a.dir !== b.dir ? (a.dir ? -1 : 1) : a.name.localeCompare(b.name, undefined, { numeric: true })));
    n.children.forEach(sort);
  };
  sort(root);
  return root;
}

export function pickDefaultFile(entries: TreeEntry[]): string | undefined {
  const pref = ["README.md", "API_CONTRACT.md", "readme.md"];
  for (const p of pref) if (entries.some((e) => e.path === p && e.content != null)) return p;
  return entries.find((e) => e.kind === "source" && e.content != null)?.path ?? entries.find((e) => e.content != null)?.path;
}

export function CodeViewer({ entries, file, onFile, line, onLine, findings }: {
  entries: TreeEntry[];
  file: string | undefined;
  onFile: (path: string) => void;
  line?: number;
  onLine?: (n: number | undefined) => void;
  /** Static-analysis findings to annotate (optional). */
  findings?: Finding[];
}) {
  const byFile = useMemo(() => {
    const m = new Map<string, Finding[]>();
    (findings ?? []).forEach((f) => { const l = m.get(f.path) ?? []; l.push(f); m.set(f.path, l); });
    return m;
  }, [findings]);
  const tree = useMemo(() => buildTree(entries), [entries]);
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const current = entries.find((e) => e.path === file);

  // Expand the folders containing the current file.
  useEffect(() => {
    if (!file) return;
    setOpen((o) => {
      const n = new Set(o);
      const parts = file.split("/");
      for (let i = 1; i < parts.length; i++) n.add(parts.slice(0, i).join("/"));
      return n;
    });
  }, [file]);

  const matches = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return null;
    return entries.filter((e) => e.path.toLowerCase().includes(f)).slice(0, 200);
  }, [filter, entries]);

  const counts = useMemo(() => ({
    files: entries.length,
    source: entries.filter((e) => e.kind === "source").length,
    tests: entries.filter((e) => e.kind === "test").length,
  }), [entries]);

  return (
    <div className="cv">
      <div className="cv-side">
        <div className="cv-filter">
          <IconSearch width={14} height={14} />
          <input placeholder="Go to file…" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter files"
            onKeyDown={(e) => { if (e.key === "Enter" && matches?.[0]) { onFile(matches[0].path); setFilter(""); } }} />
        </div>
        <div className="cv-counts num">{counts.files} files · {counts.source} source · {counts.tests} test</div>
        <div className="cv-tree" role="tree">
          {matches ? (
            matches.length ? matches.map((e) => (
              <button key={e.path} className={`cv-item ${e.path === file ? "on" : ""}`} onClick={() => { onFile(e.path); setFilter(""); }} style={{ paddingLeft: 10 }}>
                <IconFile width={14} height={14} /><span className="cv-path">{e.path}</span>
              </button>
            )) : <div className="faint" style={{ padding: 10, fontSize: 13 }}>No files match.</div>
          ) : (
            tree.children.map((n) => <TreeNode key={n.path} n={n} depth={0} open={open} setOpen={setOpen} file={file} onFile={onFile} counts={byFile} />)
          )}
        </div>
      </div>
      <div className="cv-main">
        <select className="select cv-mobile-pick" value={file} onChange={(e) => onFile(e.target.value)} aria-label="File">
          {entries.map((e) => <option key={e.path} value={e.path}>{e.path}</option>)}
        </select>
        {current ? <FileView entry={current} line={line} onLine={onLine} findings={byFile.get(current.path)} /> : <div className="cv-empty muted">Select a file.</div>}
      </div>
    </div>
  );
}

function TreeNode({ n, depth, open, setOpen, file, onFile, counts }: {
  n: Node; depth: number; open: Set<string>; setOpen: (f: (s: Set<string>) => Set<string>) => void; file?: string; onFile: (p: string) => void;
  counts: Map<string, Finding[]>;
}) {
  const isOpen = open.has(n.path);
  if (n.dir) {
    return (
      <div role="treeitem" aria-expanded={isOpen}>
        <button className="cv-item cv-dir" style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => setOpen((s) => { const x = new Set(s); if (x.has(n.path)) x.delete(n.path); else x.add(n.path); return x; })}>
          <IconChevron width={12} height={12} className={`cv-chev ${isOpen ? "open" : ""}`} />
          <IconFolder width={14} height={14} />
          <span>{n.name}</span>
        </button>
        {isOpen && n.children.map((c) => <TreeNode key={c.path} n={c} depth={depth + 1} open={open} setOpen={setOpen} file={file} onFile={onFile} counts={counts} />)}
      </div>
    );
  }
  const e = n.entry!;
  return (
    <button role="treeitem" className={`cv-item ${n.path === file ? "on" : ""} ${e.content == null ? "dim" : ""}`} style={{ paddingLeft: 26 + depth * 14 }} onClick={() => onFile(n.path)}>
      <IconFile width={14} height={14} />
      <span className="cv-name">{n.name}</span>
      {e.kind === "test" && <span className="cv-tag">test</span>}
      {counts.get(n.path)?.length ? <span className="cv-fcount num" title={`${counts.get(n.path)!.length} static-analysis findings`}>{counts.get(n.path)!.length}</span> : null}
    </button>
  );
}

function FileView({ entry, line, onLine, findings }: { entry: TreeEntry; line?: number; onLine?: (n: number | undefined) => void; findings?: Finding[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const byLine = useMemo(() => {
    const m = new Map<number, Finding[]>();
    (findings ?? []).forEach((f) => { const l = m.get(f.line) ?? []; l.push(f); m.set(f.line, l); });
    return m;
  }, [findings]);
  useEffect(() => setExpanded(line && byLine.has(line) ? line : null), [entry.path, line, byLine]);
  const [html, setHtml] = useState<string[] | null>(null);
  const [mdPreview, setMdPreview] = useState(true);
  const [copied, setCopied] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  const isMd = entry.lang === "markdown";
  const text = entry.content ?? "";
  const plain = useMemo(() => text.split("\n").map(escapeHtml), [text]);

  useEffect(() => {
    let live = true;
    setHtml(null);
    if (entry.content != null) highlightLines(entry.content, entry.lang).then((h) => live && setHtml(h)).catch(() => {});
    return () => { live = false; };
  }, [entry]);

  useEffect(() => {
    if (!line || !body.current) return;
    const el = body.current.querySelector<HTMLElement>(`[data-l="${line}"]`);
    // Scroll vertically only; scrollIntoView would also scroll long lines sideways under the sticky gutter.
    if (el) {
      const viewer = body.current.closest(".cv");
      if (viewer && viewer.getBoundingClientRect().top > window.innerHeight * 0.6) viewer.scrollIntoView({ block: "start", behavior: "smooth" });
      body.current.scrollTo({ top: el.offsetTop - body.current.clientHeight / 2, left: 0 });
    }
  }, [line, html, entry.path]);

  useEffect(() => { body.current?.scrollTo({ top: 0 }); }, [entry.path]);

  const all = html ?? plain;
  const lines = all.length > 1 && text.endsWith("\n") ? all.slice(0, -1) : all;

  return (
    <div className="fv">
      <div className="fv-head">
        <div className="fv-crumbs mono">
          {entry.path.split("/").map((p, i, a) => (
            <span key={i}>{p}{i < a.length - 1 && <span className="faint"> / </span>}</span>
          ))}
        </div>
        <span className="spacer" />
        {entry.kind === "test" && <span className="chip chip-accent">public test</span>}
        <span className="faint mono" style={{ fontSize: 11.5 }}>{entry.content != null ? `${text.split("\n").length} lines · ` : ""}{fmtBytes(entry.size)}</span>
        {isMd && entry.content != null && (
          <div className="seg" role="group" aria-label="Markdown view">
            <button aria-pressed={mdPreview} onClick={() => setMdPreview(true)}>Preview</button>
            <button aria-pressed={!mdPreview} onClick={() => setMdPreview(false)}>Source</button>
          </div>
        )}
        {entry.content != null && (
          <button className="btn btn-sm btn-ghost" onClick={() => navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); })} aria-label="Copy file">
            {copied ? <IconCheck /> : <IconCopy />}
          </button>
        )}
      </div>
      <div className="fv-body" ref={body}>
        {entry.content == null ? (
          <div className="cv-empty">
            <p className="h3">{entry.omitted === "binary" ? "Binary file" : entry.omitted === "too_large" ? "File too large to display" : "Build output"}</p>
            <p className="muted" style={{ fontSize: 13.5 }}>It is part of the task bundle; download the bundle to inspect it locally.</p>
          </div>
        ) : isMd && mdPreview ? (
          <div className="md fv-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />
        ) : (
          <table className="fv-code hl-code">
            <tbody>
              {lines.map((l, i) => {
                const fs = byLine.get(i + 1);
                const worst = fs?.reduce((a, f) => (SEVERITY[f.severity].rank < SEVERITY[a.severity].rank ? f : a));
                return (
                  <Fragment key={i}>
                    <tr data-l={i + 1} className={`${line === i + 1 ? "hl" : ""} ${fs ? "has-f" : ""}`}>
                      <td className="fm">
                        {worst && (
                          <button className="fm-dot" style={{ background: SEVERITY[worst.severity].color }} aria-label={`${fs!.length} finding(s) on line ${i + 1}`}
                            onClick={() => setExpanded(expanded === i + 1 ? null : i + 1)} title={fs!.map((f) => `${toolLabel(f.tool)}: ${f.title}`).join("\n")} />
                        )}
                      </td>
                      <td className="ln" onClick={() => onLine?.(line === i + 1 ? undefined : i + 1)}>{i + 1}</td>
                      <td className="lc" dangerouslySetInnerHTML={{ __html: l || " " }} />
                    </tr>
                    {fs && expanded === i + 1 && (
                      <tr className="f-row"><td colSpan={3}><FindingCards findings={fs} /></td></tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function FindingCards({ findings }: { findings: Finding[] }) {
  return (
    <div className="fcards">
      {findings.map((f, k) => (
        <div className="fcard" key={k}>
          <div className="row-wrap" style={{ gap: 8 }}>
            <span className="sev" style={{ ["--c" as string]: SEVERITY[f.severity].color }}>{SEVERITY[f.severity].label}</span>
            <b style={{ fontSize: 13 }}>{toolLabel(f.tool)}</b>
            <span className="mono faint" style={{ fontSize: 11.5 }}>{f.rule}</span>
            {f.cwe.map((c) => <a key={c} className="chip chip-mono" style={{ height: 20 }} href={`https://cwe.mitre.org/data/definitions/${c.slice(4)}.html`} target="_blank" rel="noreferrer">{c}</a>)}
          </div>
          <div style={{ fontSize: 13, marginTop: 4, whiteSpace: "pre-wrap" }}>{f.message}</div>
          {f.help_url && <a className="hint" href={f.help_url} target="_blank" rel="noreferrer">Rule documentation</a>}
        </div>
      ))}
    </div>
  );
}
