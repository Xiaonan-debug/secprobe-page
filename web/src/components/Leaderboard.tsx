// Paper leaderboard: 9 backbones × 2 harnesses, strict pass rate or mean grader score.
import { useMemo, useState } from "react";
import { Leaderboard as LB } from "../lib/data";
import "./leaderboard.css";

type Metric = "pass" | "score";
type Harness = "both" | "terminus" | "mini";

const SEED_SCORE = 46.8;

export function Leaderboard({ data }: { data: LB }) {
  const [metric, setMetric] = useState<Metric>("pass");
  const [harness, setHarness] = useState<Harness>("both");

  const rows = useMemo(() => {
    const key = (r: LB["rows"][number]) =>
      harness === "mini" ? r.mini[metric] : harness === "terminus" ? r.terminus[metric] : Math.max(r.mini[metric], r.terminus[metric]);
    return [...data.rows].sort((a, b) => key(b) - key(a));
  }, [data, metric, harness]);

  const max = metric === "pass" ? 40 : 100;
  const ticks = metric === "pass" ? [0, 10, 20, 30, 40] : [0, 25, 50, 75, 100];
  const show = (h: "mini" | "terminus") => harness === "both" || harness === h;
  const fmt = (v: number) => (metric === "pass" ? `${v.toFixed(2)}%` : v.toFixed(2));

  return (
    <div className="lb">
      <div className="lb-controls">
        <div className="seg" role="group" aria-label="Metric">
          <button aria-pressed={metric === "pass"} onClick={() => setMetric("pass")}>Strict pass rate</button>
          <button aria-pressed={metric === "score"} onClick={() => setMetric("score")}>Mean grader score</button>
        </div>
        <div className="seg" role="group" aria-label="Harness">
          <button aria-pressed={harness === "both"} onClick={() => setHarness("both")}>Both</button>
          <button aria-pressed={harness === "terminus"} onClick={() => setHarness("terminus")}>Terminus-2</button>
          <button aria-pressed={harness === "mini"} onClick={() => setHarness("mini")}>Mini-SWE-Agent</button>
        </div>
        <div className="lb-legend">
          {show("terminus") && <span><i className="sw sw-term" /> Terminus-2</span>}
          {show("mini") && <span><i className="sw sw-mini" /> Mini-SWE-Agent</span>}
          {metric === "score" && <span><i className="sw sw-seed" /> Vulnerable seed (46.8)</span>}
        </div>
      </div>

      <div className="lb-grid" role="table" aria-label="Leaderboard">
        <div className="lb-axis" aria-hidden="true">
          <div />
          <div className="lb-ticks">
            {ticks.map((t) => (
              <span key={t} style={{ left: `${(t / max) * 100}%` }}>{metric === "pass" ? `${t}%` : t}</span>
            ))}
          </div>
        </div>
        {rows.map((r, i) => (
          <div className="lb-row" role="row" key={r.model}>
            <div className="lb-name" role="cell">
              <span className="lb-rank num">{i + 1}</span>
              <div>
                <div className="lb-model">{r.model}</div>
                <div className="lb-prov">{r.provider}{r.open_weights ? " · open weights" : ""}</div>
              </div>
            </div>
            <div className="lb-bars" role="cell">
              <div className="lb-gridlines" aria-hidden="true">
                {ticks.map((t) => <i key={t} style={{ left: `${(t / max) * 100}%` }} />)}
                {metric === "score" && <i className="seed" style={{ left: `${(SEED_SCORE / max) * 100}%` }} />}
              </div>
              {show("terminus") && (
                <div className="lb-bar-row">
                  <div className="lb-bar term" style={{ width: `${(r.terminus[metric] / max) * 100}%` }} />
                  <span className="lb-val num">{fmt(r.terminus[metric])}</span>
                </div>
              )}
              {show("mini") && (
                <div className="lb-bar-row">
                  <div className="lb-bar mini" style={{ width: `${(r.mini[metric] / max) * 100}%` }} />
                  <span className="lb-val num">{fmt(r.mini[metric])}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="faint" style={{ fontSize: 12.5, marginTop: 16 }}>
        {data.source}. Strict pass = grader score of exactly 100 (all functional and exploit tests pass); every partial score counts as a failure.
        Mean grader score averages normalized scores across attempts; the paper reports a mean vulnerable-seed score of 46.8 before repair.
      </p>
    </div>
  );
}
