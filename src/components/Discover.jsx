import React, { useState } from "react";
import PT_DATA from "../data.js";

export default function Discover({ boards, onOpenBoard, onStart }) {
  const [cat, setCat] = useState("All");
  const cats = ["All"].concat(PT_DATA.categories);
  const items = PT_DATA.discover
    .map((d) => {
      if (!d.board) return d;
      const b = boards.find((x) => x.id === d.board);
      if (!b) return null;
      const lead = b.summary && b.summary[0] ? b.summary[0].p.replace(/\[\[[\w-]+\]\]/g, "").replace(/\s+/g, " ").slice(0, 150) + "…" : "";
      return { title: b.title, category: b.category, location: b.location, blurb: lead, board: b.id, n: b.nodes.length };
    })
    .filter(Boolean)
    .filter((d) => cat === "All" || d.category === cat);

  return (
    <div className="an-wrap">
      <div className="an-head">
        <h1>Discover investigations</h1>
        <p>Every headline has a paper trail. Pick a story and follow it. Receipts sticks to stories where the evidence, relationships, and decision-making actually add something.</p>
      </div>
      <div className="cat-row">
        {cats.map((c) => <button key={c} className={"chip" + (c === cat ? " on" : "")} onClick={() => setCat(c)}>{c}</button>)}
      </div>
      <div className="disc-grid">
        {items.length ? items.map((d, i) => (
          <button key={i} className="disc-card" onClick={() => (d.board ? onOpenBoard(d.board) : onStart(d))}>
            <span className="disc-meta"><span className="cat-chip">{d.category}</span><span>{d.location}</span></span>
            <span className="disc-title">{d.title}</span>
            <span className="disc-blurb">{d.blurb}</span>
            <span className="disc-foot">{d.board ? `📌 ${d.n} pins · open Story File` : "🧵 Start this investigation"}</span>
          </button>
        )) : <p className="muted">Nothing in this category yet.</p>}
      </div>
      <p className="muted" style={{ marginTop: 18, fontSize: 12 }}>Illustrative product concept. Riverton and everyone in it are fictional.</p>
    </div>
  );
}
