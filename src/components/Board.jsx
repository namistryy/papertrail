import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import Card from "./Card.jsx";
import { KINDS } from "../lib/constants.js";
import { neighbors, shortTitle, stringPath } from "../lib/util.js";

function Legend({ hidden, onToggle }) {
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 600);
  return (
    <div className={"legend" + (collapsed ? " collapsed" : "")}>
      <div className="legend-title">
        <span>String key</span>
        <button onClick={() => setCollapsed((c) => !c)}>{collapsed ? "show" : "hide"}</button>
      </div>
      {Object.entries(KINDS).map(([k, v]) => (
        <button key={k} className={"legend-row" + (hidden.includes(k) ? " off" : "")} onClick={() => onToggle(k)} title="Show/hide these strings">
          <svg width="26" height="8"><path d="M1 4 Q13 9 25 4" stroke={v.color} strokeWidth="2.4" fill="none" strokeDasharray={k === "origin" ? "4 3" : undefined} /></svg>
          {v.label}
        </button>
      ))}
      <div className="legend-row" style={{ cursor: "default" }}>
        <svg width="26" height="8"><path d="M1 4 Q13 9 25 4" stroke="var(--ink-2)" strokeWidth="3" fill="none" strokeDasharray="1.5 5" strokeLinecap="round" /></svg>
        Claimed, not documented
      </div>
      <div className="legend-row" style={{ cursor: "default", color: "var(--ink-3)", fontSize: 11 }}>Tap a string to see its evidence</div>
    </div>
  );
}

function StringPath({ s, i, d, cls, color, fresh }) {
  const ref = useCallback((el) => {
    if (el && fresh) el.style.setProperty("--len", Math.ceil(el.getTotalLength()));
  }, [fresh]);
  return <path ref={ref} className={cls} data-i={i} d={d} style={{ stroke: color }} />;
}

const Board = forwardRef(function Board(
  { board, selected, hidden, drops, freshStrings, onSelect, onMoveEnd, onOpenFolder, onOpenEvidence, onToggleKind },
  ref
) {
  const viewportRef = useRef(null);
  const nodesRef = useRef(null);
  const [cam, setCam] = useState({ x: 0, y: 0, k: 0.6 });
  const camRef = useRef(cam);
  camRef.current = cam;
  const [animating, setAnimating] = useState(false);
  const animT = useRef();
  const [dragPos, setDragPos] = useState(null);
  const drag = useRef(null);
  const [tip, setTip] = useState(null);

  const nodes = useMemo(
    () => board.nodes.map((n) => (dragPos && dragPos.id === n.id ? { ...n, x: dragPos.x, y: dragPos.y } : n)),
    [board.nodes, dragPos]
  );
  const byId = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);

  // ----- camera -----
  const animateTo = useCallback((next) => {
    setAnimating(true);
    setCam(next);
    clearTimeout(animT.current);
    animT.current = setTimeout(() => setAnimating(false), 750);
  }, []);
  const zoomAt = (c, f, cx, cy) => {
    const k = Math.max(0.2, Math.min(2.2, c.k * f));
    return { k, x: cx - (cx - c.x) * (k / c.k), y: cy - (cy - c.y) * (k / c.k) };
  };
  const bbox = useCallback((ids) => {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    if (!nodesRef.current) return null;
    nodesRef.current.querySelectorAll(".card").forEach((c) => {
      if (ids && !ids.has(c.dataset.id)) return;
      const x = c.offsetLeft, y = c.offsetTop;
      x1 = Math.min(x1, x); y1 = Math.min(y1, y - 12);
      x2 = Math.max(x2, x + c.offsetWidth); y2 = Math.max(y2, y + c.offsetHeight);
    });
    return isFinite(x1) ? { x1, y1, x2, y2 } : null;
  }, []);
  const fitTo = useCallback((ids, maxK = 1.1, animate = true) => {
    const vp = viewportRef.current;
    if (!vp) return;
    const vw = vp.clientWidth, vh = vp.clientHeight;
    const bb = bbox(ids);
    if (!bb) { setCam({ x: vw / 2 - 1150 * 0.6, y: vh / 2 - 650 * 0.6, k: 0.6 }); return; }
    const padX = 60, padTop = 70, padBot = 110;
    const k = Math.max(0.2, Math.min(maxK, (vw - padX * 2) / (bb.x2 - bb.x1), (vh - padTop - padBot) / (bb.y2 - bb.y1)));
    const next = {
      k,
      x: (vw - (bb.x2 - bb.x1) * k) / 2 - bb.x1 * k,
      y: padTop + (vh - padTop - padBot - (bb.y2 - bb.y1) * k) / 2 - bb.y1 * k,
    };
    animate ? animateTo(next) : setCam(next);
  }, [bbox, animateTo]);

  useImperativeHandle(ref, () => ({
    fitTo,
    focusNode: (id) => fitTo(new Set([id]), 1.5),
    bbox,
    heightOf: (id) => {
      const c = nodesRef.current && nodesRef.current.querySelector(`[data-id="${id}"]`);
      return c ? c.offsetHeight : 0;
    },
    centerWorld: () => {
      const vp = viewportRef.current, c = camRef.current;
      return { x: (vp.clientWidth / 2 - c.x) / c.k, y: (vp.clientHeight / 2 - c.y) / c.k };
    },
  }), [fitTo, bbox]);

  // fit when switching boards, on resize and once fonts load
  useEffect(() => {
    const id = requestAnimationFrame(() => fitTo(null, 1.1, false));
    return () => cancelAnimationFrame(id);
  }, [board.id, fitTo]);
  useEffect(() => {
    const onResize = () => fitTo(null, 1.1, false);
    window.addEventListener("resize", onResize);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fitTo(null, 1.1, false));
    return () => window.removeEventListener("resize", onResize);
  }, [fitTo]);

  // wheel zoom (non-passive so we can preventDefault)
  useEffect(() => {
    const vp = viewportRef.current;
    const onWheel = (e) => {
      e.preventDefault();
      const r = vp.getBoundingClientRect();
      setCam((c) => zoomAt(c, Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top));
    };
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, []);

  // ----- pointer: pan, drag cards, click cards/strings -----
  const onPointerDown = (e) => {
    if (e.button !== 0 || e.target.closest("[data-open]")) return;
    const card = e.target.closest(".card");
    if (card) {
      const n = byId[card.dataset.id];
      drag.current = { mode: "card", id: n.id, sx: e.clientX, sy: e.clientY, nx: n.x, ny: n.y, moved: false };
    } else {
      const hit = e.target.closest(".hit");
      drag.current = { mode: "pan", sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y, moved: false, hit: hit ? +hit.dataset.i : null };
      viewportRef.current.classList.add("panning");
    }
    viewportRef.current.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) {
      const h = e.target.closest && e.target.closest(".hit");
      setTip(h ? { i: +h.dataset.i, x: e.clientX, y: e.clientY } : null);
      return;
    }
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true;
    if (d.mode === "pan") setCam((c) => ({ ...c, x: d.cx + dx, y: d.cy + dy }));
    else setDragPos({ id: d.id, x: Math.round(d.nx + dx / cam.k), y: Math.round(d.ny + dy / cam.k) });
  };
  const onPointerUp = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    viewportRef.current.classList.remove("panning");
    if (d.mode === "card") {
      if (d.moved && dragPos) onMoveEnd(d.id, dragPos.x, dragPos.y);
      else if (!d.moved) onSelect(d.id === selected ? null : d.id);
      setDragPos(null);
    } else if (!d.moved && d.hit != null) { setTip(null); onOpenEvidence(d.hit); }
    else if (!d.moved && selected) onSelect(null);
  };
  const onDoubleClick = (e) => {
    const card = e.target.closest(".card");
    if (card) { onSelect(card.dataset.id); fitTo(new Set([card.dataset.id]), 1.5); }
  };
  const zoomBtn = (f) => {
    const vp = viewportRef.current;
    animateTo(zoomAt(cam, f, vp.clientWidth / 2, vp.clientHeight / 2));
  };

  // ----- focus -----
  const hasFocus = !!selected && !!byId[selected];
  const nb = hasFocus ? neighbors(board, selected) : null;

  const tipString = tip && board.strings[tip.i];
  return (
    <>
      <div className="cork" ref={viewportRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        onPointerLeave={() => setTip(null)} onDoubleClick={onDoubleClick}>
        <div className={"world" + (animating ? " animating" : "")} style={{ transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.k})` }}>
          <svg className={"strings" + (hasFocus ? " has-focus" : "")} width="4000" height="3000">
            {board.strings.map((s, i) => {
              const a = byId[s.from], c = byId[s.to];
              if (!a || !c) return null;
              const d = stringPath(a, c);
              const k = KINDS[s.kind] || KINDS.connects;
              const hid = hidden.includes(s.kind) ? " hidden-kind" : "";
              const lit = hasFocus && (s.from === selected || s.to === selected) ? " lit" : "";
              const fresh = freshStrings.includes(i);
              return (
                <g key={i}>
                  <path className={"str-shadow" + hid + lit} d={d} />
                  <StringPath s={s} i={i} d={d} color={k.color} fresh={fresh}
                    cls={`str k-${s.kind}${hid}${lit}${fresh ? " draw" : ""}${s.claimed ? " claimed" : ""}`} />
                  <path className={"hit" + hid} data-i={i} d={d} stroke="transparent" strokeWidth="16" fill="none" />
                </g>
              );
            })}
          </svg>
          <div className={"nodes" + (hasFocus ? " has-focus" : "")} ref={nodesRef}>
            {nodes.map((n) => (
              <Card key={n.id} n={n} lit={nb ? nb.has(n.id) : false} selected={n.id === selected}
                dragging={dragPos && dragPos.id === n.id} drop={drops[n.id]} onOpenFolder={onOpenFolder} />
            ))}
          </div>
        </div>
      </div>

      <Legend hidden={hidden} onToggle={onToggleKind} />
      <div className="zoom">
        <button aria-label="Zoom in" onClick={() => zoomBtn(1.25)}>+</button>
        <button aria-label="Zoom out" onClick={() => zoomBtn(0.8)}>−</button>
        <button aria-label="Fit board" title="Fit board" onClick={() => fitTo(null)}>⤢</button>
      </div>
      {tipString && byId[tipString.from] && byId[tipString.to] && (
        <div className="string-tip" style={{ left: tip.x + 14, top: tip.y + 14 }}>
          <b style={{ color: KINDS[tipString.kind].color }}>●</b> {KINDS[tipString.kind].label}: <b>{tipString.label}</b>
          {tipString.claimed && <span style={{ color: "var(--warning)" }}> · claimed</span>}
          <br />
          <span className="muted">{shortTitle(byId[tipString.from], 30)} → {shortTitle(byId[tipString.to], 30)}</span>
        </div>
      )}
    </>
  );
});

export default Board;
