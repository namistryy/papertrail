import React, { useState } from "react";
import { PLATFORMS, VERDICT, LEAN_LABELS } from "../lib/constants.js";

/* Analytics: "where you get your information".
   Visual language from the inspo boards: petal wheel (origins), concentric arcs with
   end-dots (verdicts), ring gauges (headline stats), fat pill bars (slant), and
   rule-line bars with big percentages (boards). Palette: dark roast + cream with
   bright accents. */

const ORDER = ["TikTok", "Instagram", "X", "News outlets", "Public records", "Your screenshots", "Other sources"];
// fixed categorical order (never cycled); "Other" folds to a neutral
const ORIGIN_COL = {
  TikTok: "#FF7BDD", Instagram: "#FF8B0D", X: "#1569FF", "News outlets": "#FFD93B",
  "Public records": "#31DB92", "Your screenshots": "#9292FF", "Other sources": "#8a7b66",
};
const VERDICT_COL = { verified: "#31DB92", partial: "#FFD93B", unverified: "#b9ab92", contradicted: "#FF5831" };
const VS = ["verified", "partial", "unverified", "contradicted"];
const LEAN_COL = ["#1569FF", "#9292FF", "#8a7b66", "#FF7BDD", "#FF5831"];

function category(n) {
  if (n.type === "shot") return "Your screenshots";
  if (n.type === "post") return n.platform;
  if (n.type === "clip") return "News outlets";
  if (n.type === "doc" || n.type === "folder") return n.platform === "Government record" ? "Public records" : "Other sources";
  return null;
}
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const polar = (cx, cy, r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];

function Panel({ title, desc, table, className = "", children }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className={"av-panel " + className}>
      <header>
        <div><h2>{title}</h2>{desc && <p>{desc}</p>}</div>
        {table && <button className="av-toggle" onClick={() => setShowTable((t) => !t)}>{showTable ? "Chart" : "Table"}</button>}
      </header>
      {showTable && table ? (
        <table className="av-table"><tbody>
          <tr><th>{table.head}</th><th>Sources</th></tr>
          {table.rows.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}
        </tbody></table>
      ) : children}
    </section>
  );
}

/* ---------- ring gauge (inspo 2, circles) ---------- */
function Ring({ value, color, label, sub }) {
  const r = 34, c = 2 * Math.PI * r;
  return (
    <div className="av-ring">
      <svg viewBox="0 0 84 84" width="84" height="84" role="img" aria-label={`${label}: ${value}%`}>
        <circle cx="42" cy="42" r={r} fill="none" stroke="var(--av-line)" strokeWidth="1.5" />
        <circle cx="42" cy="42" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${(c * value) / 100} ${c}`} transform="rotate(-90 42 42)" />
      </svg>
      <div>
        <div className="av-ring-val">{value}<small>%</small></div>
        <div className="av-ring-lbl">{label}</div>
        {sub && <div className="av-ring-sub">{sub}</div>}
      </div>
    </div>
  );
}

/* ---------- petal wheel (inspo 3) ---------- */
function PetalWheel({ data, onTip }) {
  const S = 300, cx = S / 2, cy = S / 2, R0 = 26, R1 = 138, pad = 0.035, round = 10;
  const max = Math.max(1, ...data.map((d) => d.v));
  const n = data.length, step = (2 * Math.PI) / n;
  const sector = (r0, r1, a0, a1) => {
    const [x0, y0] = polar(cx, cy, r1, a0), [x1, y1] = polar(cx, cy, r1, a1);
    const [x2, y2] = polar(cx, cy, r0, a1), [x3, y3] = polar(cx, cy, r0, a0);
    const lg = a1 - a0 > Math.PI ? 1 : 0;
    return `M${x0},${y0} A${r1},${r1} 0 ${lg} 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${lg} 0 ${x3},${y3}Z`;
  };
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="av-wheel" role="img" aria-label="Sources by origin">
      {data.map((d, i) => {
        const a0 = -Math.PI / 2 + i * step + pad, a1 = a0 + step - pad * 2;
        // inner petal grows by area (sqrt) so small counts stay visible
        const rIn = R0 + 6 + (R1 - R0 - 14) * Math.sqrt(d.v / max);
        const mid = (a0 + a1) / 2;
        const [lx, ly] = polar(cx, cy, Math.max(rIn + 22, 96), mid);
        const big = rIn > 92;
        const [tx, ty] = big ? polar(cx, cy, (R0 + rIn) / 2 + 8, mid) : [lx, ly];
        return (
          <g key={d.c} onMouseMove={(e) => onTip(e, `${d.c}: ${d.v} sources`)} onMouseLeave={() => onTip(null)}>
            {/* outer shell (dark), then inner petal (color); same-color stroke rounds the corners */}
            <path d={sector(R0 + round / 2, R1 - round / 2, a0 + 0.02, a1 - 0.02)} fill="var(--av-shell)" stroke="var(--av-shell)" strokeWidth={round} strokeLinejoin="round" />
            {d.v > 0 && <path d={sector(R0 + round / 2, rIn - round / 2, a0 + 0.045, a1 - 0.045)} fill={d.col} stroke={d.col} strokeWidth={round} strokeLinejoin="round" />}
            <text x={tx} y={ty - 4} textAnchor="middle" className={"av-wheel-n" + (big ? " on-color" : "")}>{d.v}</text>
            <text x={tx} y={ty + 10} textAnchor="middle" className={"av-wheel-l" + (big ? " on-color" : "")}>{d.short}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- concentric arcs with end-dots (inspo 2, top) ---------- */
function ArcRings({ rows, onTip }) {
  const W = 360, H = 250, cx = 150, cy = 230;
  const radii = rows.map((_, i) => 80 + i * 34);
  const sweep = Math.PI / 2; // 0% at 12 o'clock → 100% at 3 o'clock
  const arc = (r, f) => {
    const a0 = -Math.PI / 2, a1 = a0 + sweep * Math.max(0.001, f);
    const [x0, y0] = polar(cx, cy, r, a0), [x1, y1] = polar(cx, cy, r, a1);
    return { d: `M${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1}`, end: [x1, y1] };
  };
  const rMax = radii[radii.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="av-arcs" role="img" aria-label="Verdicts as share of checked sources">
      {[0, 25, 50, 75, 100].map((t) => {
        const a = -Math.PI / 2 + sweep * (t / 100);
        const [x0, y0] = polar(cx, cy, radii[0] - 14, a), [x1, y1] = polar(cx, cy, rMax + 10, a), [tx, ty] = polar(cx, cy, rMax + 24, a);
        return (
          <g key={t}>
            <line x1={x0} y1={y0} x2={x1} y2={y1} stroke="var(--av-line)" strokeWidth="1" />
            <text x={tx} y={ty + 4} textAnchor="middle" className="av-tick">{t}%</text>
          </g>
        );
      })}
      {rows.map((r, i) => {
        const rad = radii[i];
        const track = arc(rad, 1), fill = arc(rad, r.f);
        return (
          <g key={r.k} onMouseMove={(e) => onTip(e, `${r.label}: ${r.n} (${Math.round(r.f * 100)}%)`)} onMouseLeave={() => onTip(null)}>
            <path d={track.d} fill="none" stroke="var(--av-line)" strokeWidth="1.5" />
            <path d={fill.d} fill="none" stroke={r.col} strokeWidth="9" strokeLinecap="round" />
            <circle cx={fill.end[0]} cy={fill.end[1]} r="5.5" fill="var(--av-cream)" stroke="var(--av-bg)" strokeWidth="2" />
            <text x={cx - 10} y={cy - rad + 4} textAnchor="end" className="av-arc-lbl">{r.icon} {r.label} <tspan className="av-arc-n">{r.n}</tspan></text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- fat pill bars (inspo 1, Bar 1 / Bar 2) ---------- */
function PillBars({ values, labels, colors, onTip }) {
  const max = Math.max(1, ...values);
  return (
    <div className="av-pills">
      {values.map((v, i) => (
        <div key={i} className="av-pill-col" onMouseMove={(e) => onTip(e, `${labels[i]}: ${v}`)} onMouseLeave={() => onTip(null)}>
          <span className="av-pill-n">{v}</span>
          <span className="av-pill" style={{ height: `calc(var(--pill-w) + ${(v / max) * 100}px)`, background: colors[i], opacity: v ? 1 : 0.25 }} />
          <span className="av-pill-l">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

export default function Analytics({ boards, onOpenBoard }) {
  const [tip, setTip] = useState(null);
  const onTip = (e, label) => (e ? setTip({ label, x: e.clientX, y: e.clientY }) : setTip(null));

  const srcs = [];
  boards.forEach((b) => b.nodes.forEach((n) => { const c = category(n); if (c) srcs.push({ n, c, b }); }));
  const total = srcs.length;
  const counts = ORDER.map((c) => ({ c, v: srcs.filter((s) => s.c === c).length, col: ORIGIN_COL[c], short: c.replace(" outlets", "").replace("Public records", "Records").replace("Your screenshots", "Uploads").replace("Other sources", "Other") }));
  const social = srcs.filter((s) => PLATFORMS.includes(s.c)).length;
  const records = srcs.filter((s) => s.c === "Public records").length;

  const seeds = [];
  boards.forEach((b) => {
    b.nodes.forEach((n) => { if (n.seed) seeds.push(category(n) || "Typed question"); });
    if (b.nodes.length && !b.nodes.some((n) => n.seed)) seeds.push("Typed question");
  });
  const tally = {}; seeds.forEach((x) => (tally[x] = (tally[x] || 0) + 1));
  const [seedTop, seedN] = Object.entries(tally).sort((a, b) => b[1] - a[1])[0] || ["–", 0];

  const vcount = VS.map((v) => ({ k: v, n: srcs.filter((s) => s.n.checks && s.n.checks.validity && s.n.checks.validity.verdict === v).length }));
  const vtotal = vcount.reduce((a, c) => a + c.n, 0);
  const arcRows = vcount.map((x) => ({ ...x, f: vtotal ? x.n / vtotal : 0, label: VERDICT[x.k].label, icon: VERDICT[x.k].icon, col: VERDICT_COL[x.k] }));
  const lean = [-2, -1, 0, 1, 2].map((l) => srcs.filter((s) => s.n.checks && s.n.checks.bias && s.n.checks.bias.lean === l).length);
  const socialChecked = srcs.filter((s) => PLATFORMS.includes(s.c) && s.n.checks && s.n.checks.validity);
  const sv = socialChecked.filter((s) => s.n.checks.validity.verdict === "verified").length;
  const perBoard = boards.map((b) => ({ b, n: srcs.filter((s) => s.b === b).length })).filter((x) => x.n > 0);

  return (
    <div className="av">
      <div className="av-wrap">
        <header className="av-head">
          <div className="av-kicker">Your information diet</div>
          <h1>Where you get your information.</h1>
        </header>

        <div className="av-rings">
          <Ring value={pct(social, total)} color="#FF7BDD" label="From social feeds" sub="TikTok, Instagram & X" />
          <Ring value={pct(vcount[0].n, vtotal)} color="#31DB92" label="Verified overall" sub="of agent-checked sources" />
          <Ring value={pct(records, total)} color="#1569FF" label="Straight from the record" sub="public records & filings" />
          <div className="av-ring av-ring-text">
            <div className="av-chip" style={{ background: ORIGIN_COL[seedTop] || "var(--av-cream)" }}>{seedTop}</div>
            <div>
              <div className="av-ring-lbl">Your questions start here</div>
              <div className="av-ring-sub">{seedN} of {seeds.length} boards</div>
            </div>
          </div>
        </div>

        <div className="av-grid">
          <Panel title="Sources by where they came from" desc="Petal size = number of pinned sources" className="av-span"
            table={{ head: "Origin", rows: counts.map((x) => [x.c, x.v]) }}>
            <div className="av-wheel-wrap">
              <PetalWheel data={counts} onTip={onTip} />
              <ul className="av-legend">
                {counts.map((x) => (
                  <li key={x.c}><span className="av-dot" style={{ background: x.col }} />{x.c}<b>{x.v}</b></li>
                ))}
              </ul>
            </div>
          </Panel>

          <Panel title="How your sources hold up" desc="Evidence Checker status, as a share of checked sources"
            table={{ head: "Status", rows: arcRows.map((x) => [x.label, x.n]) }}>
            <ArcRings rows={arcRows} onTip={onTip} />
          </Panel>

          <Panel title="Framing slant" desc="Bias Hound's read on each source, for or against its topic"
            table={{ head: "Slant", rows: lean.map((v, i) => [LEAN_LABELS[i], v]) }}>
            <PillBars values={lean} labels={["Strongly for", "Leans for", "Neutral", "Leans against", "Strongly against"]} colors={LEAN_COL} onTip={onTip} />
          </Panel>

          <Panel title="Boards" desc="Share of your pinned sources" className="av-span">
            <div className="av-lines">
              {perBoard.map(({ b, n }) => (
                <button key={b.id} className="av-line-row" onClick={() => onOpenBoard(b.id)}>
                  <span className="av-line-track"><span className="av-line" style={{ width: pct(n, total) + "%" }} /></span>
                  <span className="av-line-pct">{pct(n, total)}%</span>
                  <span className="av-line-lbl">{b.title}<small>{n} sources · {b.strings.length} strings</small></span>
                </button>
              ))}
            </div>
          </Panel>
        </div>

        <aside className="av-note">
          <span className="av-note-k">Detective's note</span>
          <p>
            {social ? `${pct(social, total)}% of what you pin comes from social feeds, and only ${pct(sv, socialChecked.length)}% of those posts held up on their own.` : "You haven't pinned social posts yet."}{" "}
            {records ? `The answers usually came from public records (${records} pinned). Going to the record first is the fastest way to the truth.` : ""}
          </p>
        </aside>
      </div>
      {tip && <div className="av-tip" style={{ left: Math.min(tip.x + 14, window.innerWidth - 220), top: tip.y + 14 }}>{tip.label}</div>}
    </div>
  );
}
