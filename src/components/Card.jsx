import React from "react";
import { PIN, VERDICT, statusVar } from "../lib/constants.js";

function Badges({ n, style }) {
  if (!n.checks) return null;
  const c = n.checks;
  const v = c.validity && (VERDICT[c.validity.verdict] || VERDICT.unverified);
  const lean = c.bias && c.bias.lean;
  const leanCol = lean < 0 ? "#2f7de0" : lean > 0 ? "#d03b3b" : "#8a897f";
  const hops = c.origin && c.origin.chain ? c.origin.chain.length : 0;
  return (
    <div className="badges" style={style}>
      {v && (
        <span className="bdg" title="Evidence Checker">
          <span className="dot" style={{ background: `var(--${statusVar(c.validity.verdict)})` }} />
          {v.icon} {v.short || v.label}
        </span>
      )}
      {c.bias && (
        <span className="bdg" title={"Bias Hound: " + c.bias.label}>
          <span className="dot" style={{ background: leanCol }} />
          {lean === 0 ? "Neutral" : "Slanted"}
        </span>
      )}
      {hops > 0 && <span className="bdg" title="Tracer">🧭 {hops === 1 ? "original" : hops + " hops"}</span>}
    </div>
  );
}

const STAMP_COLOR = { AMENDED: "#7d3fb0", ORIGINAL: "#2f6fd6" };

function Inner({ n, onOpenFolder, onGo }) {
  switch (n.type) {
    case "post":
      return (
        <>
          <div className="post-head"><span className={"plat " + n.platform}>{n.platform}</span><span className="handle">{n.handle}</span></div>
          <div className={"post-media " + n.platform}>{n.title}</div>
          <div className="post-foot"><span>{n.date}</span><span>{n.stats}</span></div>
          <Badges n={n} />
        </>
      );
    case "shot":
      return (
        <>
          <div className="post-head"><span className="plat Upload">Screenshot</span><span className="handle">uploaded by you</span></div>
          <img src={n.img} alt="Uploaded screenshot" draggable="false" />
          <div className="post-foot"><span>{n.date || "today"}</span><span>{n.stats}</span></div>
          <Badges n={n} />
        </>
      );
    case "doc":
      return (
        <>
          {n.stamp && <span className="stamp" style={{ "--stamp": STAMP_COLOR[n.stamp] || "#b8322a" }}>{n.stamp}</span>}
          <h4 className="doc-title">{n.title}</h4>
          <div className="doc-date">{n.date}</div>
          <div className="doc-body">{n.body}</div>
          <Badges n={n} />
        </>
      );
    case "note":
      return (
        <>
          <div className="note-title">{n.title}</div>
          <div className="note-body">{n.body}</div>
          <div className="note-agent">{n.agent === "You" ? "— you" : n.agent ? `— ${n.agent} agent` : ""}</div>
        </>
      );
    case "folder":
      return (
        <>
          <div className="folder-tab" />
          <div className="folder-body">
            <div className="folder-peek" />
            <div className="folder-label">{n.title}</div>
            <div className="folder-meta">
              <span>{(n.files || []).length} files</span>
              <button className="folder-open" data-open={n.id} onClick={() => onOpenFolder(n.id)}>Open folder</button>
            </div>
            <Badges n={n} style={{ marginTop: 10 }} />
          </div>
        </>
      );
    case "clip":
      return (
        <>
          <div className="clip-outlet">{n.outlet || "Local news"} · {n.date}</div>
          <div className="clip-title">{n.title}</div>
          <div className="clip-body">{n.body}</div>
          <Badges n={n} />
        </>
      );
    default:
      return n.title;
  }
}

export default function Card({ n, lit, selected, dragging, drop, onOpenFolder, onGo }) {
  const cls = ["card", n.type, n.color || "", lit ? "lit" : "", selected ? "selected" : "", dragging ? "dragging" : "", drop != null ? "drop" : ""].join(" ");
  return (
    <div
      className={cls}
      data-id={n.id}
      tabIndex={0}
      aria-label={`Inspect ${n.title}`}
      onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onGo?.(n.id); } }}
      style={{ left: n.x, top: n.y, width: n.w || 230, "--rot": (n.rot || 0) + "deg", animationDelay: drop ? drop + "ms" : undefined }}
    >
      <span className="pin" style={{ "--pin": PIN[n.type] || "#c0392b" }} />
      <Inner n={n} onOpenFolder={onOpenFolder} onGo={onGo} />
    </div>
  );
}
