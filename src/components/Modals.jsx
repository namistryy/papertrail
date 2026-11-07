import React, { useState } from "react";
import { KINDS } from "../lib/constants.js";
import { shortTitle, wordDiff } from "../lib/util.js";

function Shell({ className, onClose, children }) {
  return (
    <div className="modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={className}>
        <button className="close" aria-label="Close" onClick={onClose}>✕</button>
        {children}
      </div>
    </div>
  );
}

export function FolderModal({ n, onClose, onDig }) {
  return (
    <Shell className="modal-card" onClose={onClose}>
      <h3>{n.title}</h3>
      <div style={{ fontSize: 13, opacity: 0.75 }}>{(n.files || []).length} documents{n.checks ? " · " + n.checks.origin.chain.join(" · ") : ""}</div>
      <div className="files">
        {(n.files || []).map((f, i) => (
          <div className="file" key={i} style={{ animationDelay: i * 70 + "ms" }}><b>{f.t}</b><span>{f.d}</span></div>
        ))}
      </div>
      <div style={{ marginTop: 16 }}>
        <button className="btn" style={{ background: "#3f2f14", color: "#f6e7c8", borderColor: "#3f2f14" }} onClick={onDig}>🧵 Pin these as separate sources</button>
      </div>
    </Shell>
  );
}

export function EvidenceModal({ board, s, onClose, onGo }) {
  const a = board.nodes.find((n) => n.id === s.from), c = board.nodes.find((n) => n.id === s.to);
  if (!a || !c) return null;
  const k = KINDS[s.kind];
  const docNode = [a, c].find((x) => x.checks && x.checks.validity && x.checks.validity.verdict === "verified") || a;
  const ev = s.ev || (docNode.checks && docNode.checks.origin ? "Documented in: " + docNode.checks.origin.chain.join(" → ") : "Connection drawn by the agents from the linked sources.");
  return (
    <Shell className="modal-card paper" onClose={onClose}>
      <div className="sf-kicker" style={{ color: "#8a7d6c" }}>Evidence behind this string</div>
      <h3 style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <svg width="34" height="10"><path d="M1 5 Q17 11 33 5" stroke={k.color} strokeWidth="3" fill="none" strokeDasharray={s.claimed ? "2 5" : s.kind === "origin" ? "5 4" : undefined} /></svg>
        {k.label}
      </h3>
      <div className="ev-route">
        <button className="ev-node" onClick={() => onGo(a.id)}>{shortTitle(a, 50)}</button>
        <span className="ev-arrow">→ {s.label} →</span>
        <button className="ev-node" onClick={() => onGo(c.id)}>{shortTitle(c, 50)}</button>
      </div>
      <div className={"ev-status " + (s.claimed ? "claimed" : "doc")}>{s.claimed ? "⚠ Claimed connection, not documented" : "✓ Documented connection"}</div>
      <p className="ev-text">{ev}</p>
      {s.kind === "money" && !s.claimed && (
        <p className="ev-note">A disclosed contribution is a documented fact. It doesn't, by itself, establish that the money influenced a decision.</p>
      )}
    </Shell>
  );
}

export function PaperTrailModal({ n, onClose }) {
  const V = n.versions;
  const [idx, setIdx] = useState(V.length - 1);
  const [base, setBase] = useState("prev");
  const cur = V[idx];
  const prev = idx === 0 ? null : base === "orig" ? V[0] : V[idx - 1];
  let changes = 0;
  const rows = cur.clauses.map((cl) => {
    const old = prev && prev.clauses.find((x) => x.k === cl.k);
    if (!prev) return <li key={cl.k}>{cl.t}</li>;
    if (!old) { changes++; return <li key={cl.k} className="added"><span className="tag">added</span><ins>{cl.t}</ins></li>; }
    if (old.t !== cl.t) {
      changes++;
      return (
        <li key={cl.k} className="changed"><span className="tag">changed</span>
          {wordDiff(old.t, cl.t).map((p, i) => (
            <React.Fragment key={i}>{p.op === "ins" ? <ins>{p.t}</ins> : p.op === "del" ? <del>{p.t}</del> : p.t}{" "}</React.Fragment>
          ))}
        </li>
      );
    }
    return <li key={cl.k} className="same">{cl.t}</li>;
  });
  if (prev) prev.clauses.forEach((cl) => {
    if (!cur.clauses.find((x) => x.k === cl.k)) { changes++; rows.push(<li key={"rm-" + cl.k} className="removed"><span className="tag">removed</span><del>{cl.t}</del></li>); }
  });
  return (
    <Shell className="modal-card paper wide" onClose={onClose}>
      <div className="sf-kicker" style={{ color: "#8a7d6c" }}>Paper Trail · how the decision changed</div>
      <h3>{n.title.replace(/ — (Final|Draft)$/, "")}</h3>
      <div className="pt-steps">
        {V.map((v, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="pt-line" />}
            <button className={"pt-step" + (i === idx ? " on" : "")} onClick={() => setIdx(i)}><b>{v.v}</b><span>{v.d}</span></button>
          </React.Fragment>
        ))}
      </div>
      {idx > 0 && (
        <div className="pt-base">Compare with:
          <button className={base === "prev" ? "on" : ""} onClick={() => setBase("prev")}>previous version</button>
          <button className={base === "orig" ? "on" : ""} onClick={() => setBase("orig")}>original</button>
        </div>
      )}
      <div className="pt-why">
        <b>{cur.v} · {cur.d}:</b> {cur.why}{" "}
        {prev && <span className="muted-ink">{changes} change{changes === 1 ? "" : "s"} vs. {base === "orig" ? "original" : "previous"}.</span>}
      </div>
      <ol className="pt-text">{rows}</ol>
      <p className="ev-note">Text shown is the actual clause language from each version on file with the City Clerk (fictional demo).</p>
    </Shell>
  );
}
