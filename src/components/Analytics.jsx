import React, { useState } from "react";
import { PLATFORMS, VERDICT, LEAN_LABELS, statusVar } from "../lib/constants.js";

const ORDER = ["TikTok", "Instagram", "X", "News outlets", "Public records", "Your screenshots", "Other sources"];
const LEAN_COL = ["#1c5cab", "#6da7ec", "#8a897f", "#ec8a8a", "#d03b3b"];
const VS = ["verified", "partial", "unverified", "contradicted"];

function category(n) {
  if (n.type === "shot") return "Your screenshots";
  if (n.type === "post") return n.platform;
  if (n.type === "clip") return "News outlets";
  if (n.type === "doc" || n.type === "folder") return n.platform === "Government record" ? "Public records" : "Other sources";
  return null;
}

function Panel({ title, desc, table, children }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <div className="panel">
      {table && <button className="tbl-toggle" onClick={() => setShowTable((t) => !t)}>{showTable ? "Chart" : "Table"}</button>}
      <h2>{title}</h2><p className="desc">{desc}</p>
      {showTable && table ? (
        <table className="dt"><tbody>
          <tr><th>{table.head}</th><th>Sources</th></tr>
          {table.rows.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}
        </tbody></table>
      ) : children}
    </div>
  );
}

export default function Analytics({ boards, onOpenBoard }) {
  const [tip, setTip] = useState(null);
  const srcs = [];
  boards.forEach((b) => b.nodes.forEach((n) => { const c = category(n); if (c) srcs.push({ n, c }); }));
  const counts = ORDER.map((c) => ({ c, v: srcs.filter((s) => s.c === c).length }));
  const total = srcs.length || 1;
  const max = Math.max(1, ...counts.map((x) => x.v));
  const social = srcs.filter((s) => PLATFORMS.includes(s.c)).length;

  const seeds = [];
  boards.forEach((b) => {
    b.nodes.forEach((n) => { if (n.seed) seeds.push(category(n) || "Typed question"); });
    if (b.nodes.length && !b.nodes.some((n) => n.seed)) seeds.push("Typed question");
  });
  const tally = {}; seeds.forEach((x) => (tally[x] = (tally[x] || 0) + 1));
  const [seedTop, seedN] = Object.entries(tally).sort((a, b) => b[1] - a[1])[0] || ["–", 0];

  const vcount = VS.map((v) => ({ v, n: srcs.filter((s) => s.n.checks && s.n.checks.validity && s.n.checks.validity.verdict === v).length }));
  const vtotal = vcount.reduce((a, c) => a + c.n, 0) || 1;
  const lean = [-2, -1, 0, 1, 2].map((l) => srcs.filter((s) => s.n.checks && s.n.checks.bias && s.n.checks.bias.lean === l).length);
  const lmax = Math.max(1, ...lean);
  const socialChecked = srcs.filter((s) => PLATFORMS.includes(s.c) && s.n.checks && s.n.checks.validity);
  const sv = socialChecked.filter((s) => s.n.checks.validity.verdict === "verified").length;
  const records = srcs.filter((s) => s.c === "Public records").length;
  const pct = (a, b) => Math.round((a / b) * 100);

  const tipProps = (label) => ({
    onMouseMove: (e) => setTip({ label, x: e.clientX, y: e.clientY }),
    onMouseLeave: () => setTip(null),
  });

  return (
    <div className="an-wrap">
      <div className="an-head"><h1>Where you get your information</h1><p>Across all {boards.length} of your boards. Updates as you pin new sources.</p></div>
      <div className="tiles">
        <div className="tile"><div className="lbl">Sources pinned</div><div className="val">{srcs.length}</div><div className="sub">across {boards.length} boards</div></div>
        <div className="tile"><div className="lbl">From social media</div><div className="val">{pct(social, total)}%</div><div className="sub">TikTok, Instagram & X</div></div>
        <div className="tile"><div className="lbl">Verified overall</div><div className="val">{pct(vcount[0].n, vtotal)}%</div><div className="sub">of agent-checked sources</div></div>
        <div className="tile"><div className="lbl">Your questions start on</div><div className="val" style={{ fontSize: 24, paddingTop: 6 }}>{seedTop}</div><div className="sub">{seedN} of {seeds.length} boards</div></div>
      </div>
      <div className="panels">
        <Panel title="Sources by where they came from" desc="Count of pinned sources by origin" table={{ head: "Origin", rows: counts.map((x) => [x.c, x.v]) }}>
          {counts.map((x) => (
            <div key={x.c} className="hbar" {...tipProps(`${x.c}: ${x.v} sources (${pct(x.v, total)}%)`)}>
              <span className="name">{x.c}</span>
              <span className="track"><span className="fill" style={{ display: "block", width: (x.v / max) * 100 + "%" }} /></span>
              <span className="num">{x.v}</span>
            </div>
          ))}
        </Panel>
        <Panel title="How your sources hold up" desc="Evidence Checker status, based on available evidence" table={{ head: "Status", rows: vcount.map((x) => [VERDICT[x.v].label, x.n]) }}>
          <div className="stack">
            {vcount.filter((x) => x.n).map((x) => (
              <div key={x.v} style={{ flex: x.n, background: `var(--${statusVar(x.v)})` }} {...tipProps(`${VERDICT[x.v].label}: ${x.n} (${pct(x.n, vtotal)}%)`)} />
            ))}
          </div>
          <div className="stack-legend">
            {vcount.map((x) => (
              <div key={x.v} className="r"><span className="sw" style={{ background: `var(--${statusVar(x.v)})` }} />{VERDICT[x.v].icon} {VERDICT[x.v].label}<b>{x.n}</b></div>
            ))}
          </div>
        </Panel>
        <Panel title="Framing slant" desc="Bias Hound's read on each source, for or against its topic" table={{ head: "Slant", rows: lean.map((v, i) => [LEAN_LABELS[i], v]) }}>
          <div className="diverge">
            {lean.map((v, i) => (
              <div key={i} className="col" {...tipProps(`${LEAN_LABELS[i]}: ${v}`)}>
                <span className="n">{v}</span>
                <span className="bar" style={{ height: (v / lmax) * 80 + "%", background: LEAN_COL[i] }} />
              </div>
            ))}
          </div>
          <div className="diverge-labels">{LEAN_LABELS.map((l) => <span key={l}>{l}</span>)}</div>
        </Panel>
        <Panel title="Boards" desc="Sources per board">
          {boards.map((b) => (
            <button key={b.id} className="board-item" onClick={() => onOpenBoard(b.id)}>
              <span className="thumb" />
              <span><div className="t">{b.title}</div><div className="m">{b.nodes.filter((x) => category(x)).length} sources · {b.strings.length} strings</div></span>
            </button>
          ))}
        </Panel>
      </div>
      <div className="insight">
        <span className="ic">🕵️</span>
        <div>
          <b>Detective's note:</b>{" "}
          {social ? `${pct(social, total)}% of what you pin comes from social feeds, and only ${socialChecked.length ? pct(sv, socialChecked.length) : 0}% of those posts held up on their own.` : "You haven't pinned social posts yet."}{" "}
          {records ? `The answers usually came from public records (${records} pinned). Going to the record first is the fastest way to the truth.` : ""}
        </div>
      </div>
      {tip && <div className="tip" style={{ left: Math.min(tip.x + 14, window.innerWidth - 220), top: tip.y + 14 }}>{tip.label}</div>}
    </div>
  );
}
