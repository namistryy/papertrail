import React from "react";
import Logo from "./Logo.jsx";

export function InboxItem({ p, onPick }) {
  return (
    <button className="inbox-item" onClick={() => onPick(p.id)}>
      <span className="row"><span className={"plat " + p.platform}>{p.platform}</span>{p.handle} · {p.date}</span>
      {p.title}
    </button>
  );
}

export default function Drawer({ open, onClose, boards, activeId, inbox, onSwitch, onNew, onPickInbox, onAnalytics, onReset }) {
  return (
    <>
      {open && <div className="scrim" onClick={onClose} />}
      <nav className={"drawer" + (open ? " open" : "")} aria-label="Boards">
        <div className="drawer-head">
          <Logo />
          <button className="icon-btn" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        <button className="new-board" onClick={onNew}>+ New board</button>
        <div className="drawer-label">Your boards</div>
        {boards.map((b) => {
          const src = b.nodes.filter((n) => n.type !== "note").length;
          return (
            <button key={b.id} className={"board-item" + (b.id === activeId ? " active" : "")} onClick={() => onSwitch(b.id)}>
              <span className="thumb">
                {b.nodes.length > 0 && [0, 1, 2].map((i) => (
                  <i key={i} style={{ left: 4 + i * 9, top: 6 + (i % 2) * 14, transform: `rotate(${i * 9 - 8}deg)` }} />
                ))}
              </span>
              <span><div className="t">{b.title}</div><div className="m">{src} sources · {b.strings.length} strings</div></span>
            </button>
          );
        })}
        <div className="drawer-label">Shared to Paper Trail {inbox.length > 0 && <span className="badge">{inbox.length}</span>}</div>
        <div className="drawer-inbox">
          {inbox.length
            ? inbox.map((p) => <InboxItem key={p.id} p={p} onPick={onPickInbox} />)
            : <p className="muted" style={{ padding: "0 6px" }}>Share a post from Instagram, TikTok or X to Paper Trail and it lands here.</p>}
        </div>
        <div className="drawer-foot">
          <button className="link-btn" onClick={onAnalytics}>📊 Where you get your info</button>
          <button className="link-btn" onClick={onReset}>↺ Reset demo data</button>
        </div>
      </nav>
    </>
  );
}
