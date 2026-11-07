import React, { useCallback, useEffect, useRef, useState } from "react";
import Board from "./components/Board.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Composer from "./components/Composer.jsx";
import Drawer, { InboxItem } from "./components/Drawer.jsx";
import PT_DATA from "./data.js";
import Analytics from "./components/Analytics.jsx";
import { FolderModal, EvidenceModal, PaperTrailModal } from "./components/Modals.jsx";
import { loadState, saveState, freshState } from "./lib/store.js";
import { generateBoard, generateSteps, digDeeper, digSteps, questionNote, postNode, shotNode } from "./lib/agents.js";
import { sleep, uid, shortTitle } from "./lib/util.js";

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
const ORIGIN = { x: 1150, y: 600 };

export default function App() {
  // ----- persisted state: boards, share inbox, active board -----
  const [S, setS] = useState(loadState);
  const Sref = useRef(S);
  Sref.current = S;
  useEffect(() => { if (!saveState(S)) showToast("Couldn't save locally (storage full?), so changes only last this session"); }, [S]);

  // ----- UI state -----
  const [selected, setSelected] = useState(null);
  const [hidden, setHidden] = useState([]);
  const [view, setView] = useState("board");
  const [tab, setTab] = useState("summary");
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1000);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [ticker, setTicker] = useState(null);
  const [attach, setAttach] = useState(null);
  const [toast, setToast] = useState(null);
  const [drops, setDrops] = useState({});
  const [fresh, setFresh] = useState([]);
  const [placeholder, setPlaceholder] = useState(null);
  const busy = useRef(false);
  const boardApi = useRef(null);
  const composer = useRef(null);
  const summaryRef = useRef(null);
  const toastT = useRef();

  const board = S.boards.find((b) => b.id === S.activeId) || S.boards[0];
  const selectedNode = selected ? board.nodes.find((n) => n.id === selected) : null;
  const getBoard = (id) => Sref.current.boards.find((b) => b.id === id);
  const updateBoard = useCallback((id, fn) => setS((s) => ({ ...s, boards: s.boards.map((b) => (b.id === id ? fn(b) : b)) })), []);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(null), 2600);
  }
  function markDrops(nodes, step) {
    setDrops((d) => ({ ...d, ...Object.fromEntries(nodes.map((n, i) => [n.id, i * step])) }));
    setTimeout(() => setDrops((d) => { const c = { ...d }; nodes.forEach((n) => delete c[n.id]); return c; }), 1200 + nodes.length * step);
  }
  function markFresh(start, count) {
    setFresh(Array.from({ length: count }, (_, i) => start + i));
    setTimeout(() => setFresh([]), 1400);
  }
  async function runTicker(steps) {
    setTicker([]);
    for (const s of steps) {
      setTicker((t) => [...(t || []), { t: s, done: false }]);
      await sleep(520 + Math.random() * 300);
      setTicker((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, done: true } : x)));
    }
    await sleep(250);
  }
  const hideTicker = () => setTimeout(() => setTicker(null), 900);

  function select(id, opts = {}) {
    setSelected(id);
    if (id) { setTab("inspect"); if (opts.open !== false) setSidebarOpen(true); }
  }
  const focusNode = (id) => boardApi.current && boardApi.current.focusNode(id);
  const freeSpot = () => {
    const bb = boardApi.current && boardApi.current.bbox();
    return bb ? { x: bb.x2 + 220, y: (bb.y1 + bb.y2) / 2 } : ORIGIN;
  };

  // ----- boards -----
  function newBoard() {
    const b = { id: uid("b-"), title: "Untitled board", question: "", created: new Date().toISOString().slice(0, 10), nodes: [], strings: [], summary: [], qa: [], log: [] };
    setS((s) => ({ ...s, boards: [b, ...s.boards], activeId: b.id }));
    setSelected(null); setView("board"); setDrawerOpen(false); setPlaceholder(null);
    setTimeout(() => composer.current && composer.current.focus(), 50);
    return b.id;
  }
  function switchBoard(id) {
    setS((s) => ({ ...s, activeId: id }));
    setSelected(null); setView("board"); setDrawerOpen(false); setPlaceholder(null);
  }
  function resetDemo() {
    setS(freshState());
    setSelected(null); setView("board"); setDrawerOpen(false);
    showToast("Demo data reset");
  }

  // ----- adding sources -----
  async function pinSeed(p) {
    const bId = Sref.current.activeId;
    const empty = !getBoard(bId).nodes.length;
    const c = empty ? ORIGIN : freeSpot();
    const n = postNode(p, Math.round(c.x - 115), Math.round(c.y - 120));
    updateBoard(bId, (b) => ({ ...b, nodes: [...b.nodes, n], title: empty && b.title === "Untitled board" ? p.handle + " post" : b.title }));
    markDrops([n], 0);
    select(n.id, { open: false });
    setPlaceholder("What do you want to know about this post?");
    await nextFrame();
    empty ? boardApi.current.fitTo(new Set([n.id]), 1.2) : focusNode(n.id);
    composer.current.focus();
    showToast("Pinned to the board. Now ask a question about it.");
  }
  function pickInbox(id) {
    const p = Sref.current.inbox.find((x) => x.id === id);
    if (!p) return;
    setView("board"); setDrawerOpen(false);
    setS((s) => ({ ...s, inbox: s.inbox.filter((x) => x.id !== id) }));
    pinSeed(p);
  }
  function addUserNote(text) {
    const c = boardApi.current.centerWorld();
    const n = { id: uid("n"), type: "note", color: "yellow", agent: "You", title: "MY NOTE", body: text || "Tap to edit in the Inspect panel", x: Math.round(c.x - 105), y: Math.round(c.y - 80), w: 210, rot: -2 };
    updateBoard(S.activeId, (b) => ({ ...b, nodes: [...b.nodes, n] }));
    markDrops([n], 0);
    select(n.id);
  }
  const removeNode = (id) => {
    updateBoard(S.activeId, (b) => ({ ...b, nodes: b.nodes.filter((n) => n.id !== id), strings: b.strings.filter((s) => s.from !== id && s.to !== id) }));
    setSelected(null);
    showToast("Removed from board");
  };
  const editNote = (id, body) => updateBoard(S.activeId, (b) => ({ ...b, nodes: b.nodes.map((n) => (n.id === id ? { ...n, body } : n)) }));
  const moveNode = (id, x, y) => updateBoard(S.activeId, (b) => ({ ...b, nodes: b.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)) }));

  // ----- agents -----
  async function runGenerate(bId, q, seedId) {
    busy.current = true;
    await nextFrame();
    let seed = seedId && getBoard(bId).nodes.find((n) => n.id === seedId);
    if (!seed) {
      seed = questionNote(q, ORIGIN);
      updateBoard(bId, (b) => ({ ...b, nodes: [...b.nodes, seed] }));
      markDrops([seed], 0);
      nextFrame().then(() => boardApi.current.fitTo(new Set([seed.id]), 1.1));
    }
    updateBoard(bId, (b) => ({
      ...b,
      question: b.question || q,
      title: b.title === "Untitled board" || /post$|investigation$/.test(b.title) ? (q.length > 48 ? q.slice(0, 47) + "…" : q) : b.title,
    }));
    await runTicker(generateSteps(seed, q));

    const res = generateBoard(q, seed);
    updateBoard(bId, (b) => ({
      ...b,
      nodes: [...b.nodes.map((n) => (n.id === seed.id && res.seedChecks ? { ...n, checks: res.seedChecks } : n)), ...res.nodes],
    }));
    markDrops(res.nodes, 140);
    nextFrame().then(() => boardApi.current.fitTo(null, 1.0));
    await sleep(res.nodes.length * 140 + 200);

    const start = getBoard(bId).strings.length;
    updateBoard(bId, (b) => ({ ...b, strings: [...b.strings, ...res.strings], summary: res.summary, log: [...(b.log || []), ...res.log] }));
    markFresh(start, res.strings.length);
    hideTicker();
    busy.current = false;
    setTab("summary"); setSidebarOpen(true); setPlaceholder(null);
  }

  async function runDig(bId, nodeId, q) {
    busy.current = true;
    let node = getBoard(bId).nodes.find((n) => n.id === nodeId);
    q = q || `Dig deeper into ${shortTitle(node, 40)}`;
    select(nodeId, { open: false });
    focusNode(nodeId);
    await runTicker(digSteps(node, q));

    const b0 = getBoard(bId);
    node = b0.nodes.find((n) => n.id === nodeId);
    const res = digDeeper(b0, node, q, boardApi.current.heightOf);
    updateBoard(bId, (b) => ({ ...b, nodes: [...b.nodes, ...res.nodes] }));
    markDrops(res.nodes, 150);
    nextFrame().then(() => boardApi.current.fitTo(new Set([nodeId, ...res.nodes.map((n) => n.id)]), 1.0));
    await sleep(res.nodes.length * 150 + 250);

    const start = getBoard(bId).strings.length;
    updateBoard(bId, (b) => ({ ...b, strings: [...b.strings, ...res.strings], qa: [...(b.qa || []), res.qa], log: [...(b.log || []), ...res.log] }));
    markFresh(start, res.strings.length);
    hideTicker();
    busy.current = false;
    setTab("summary"); setSidebarOpen(true);
    await nextFrame();
    if (summaryRef.current) summaryRef.current.scrollTop = summaryRef.current.scrollHeight;
  }

  async function ask(q) {
    if (busy.current) return showToast("The agents are still working…");
    setView("board");
    const bId = Sref.current.activeId;
    const b = getBoard(bId);
    let targetId = selected && b.nodes.some((n) => n.id === selected) ? selected : null;
    if (attach) {
      const c = b.nodes.length ? freeSpot() : ORIGIN;
      const n = shotNode(attach, Math.round(c.x - 120), Math.round(c.y - 140));
      setAttach(null);
      updateBoard(bId, (x) => ({ ...x, nodes: [...x.nodes, n], title: x.title === "Untitled board" ? "Screenshot investigation" : x.title }));
      markDrops([n], 0);
      targetId = n.id;
      if (!b.nodes.length) nextFrame().then(() => boardApi.current.fitTo(new Set([n.id]), 1.1));
    }
    if (b.strings.length === 0) {
      const seed = targetId || (b.nodes.find((n) => n.seed || n.type === "shot") || {}).id;
      return runGenerate(bId, q, seed);
    }
    const target = targetId || (b.nodes.find((n) => n.seed) || b.nodes[0]).id;
    return runDig(bId, target, q);
  }
  const dig = (id) => (busy.current ? showToast("The agents are still working…") : runDig(S.activeId, id, null));

  // trending searches by the Ask bar: open the existing board, or start a new investigation
  function openTrending(t) {
    if (busy.current) return showToast("The agents are still working…");
    if (t.board && S.boards.some((b) => b.id === t.board)) return switchBoard(t.board);
    const id = newBoard();
    updateBoard(id, (b) => ({ ...b, question: t.q, title: t.q }));
    runGenerate(id, t.q, null);
  }

  // ----- modals -----
  const openFolder = (id) => setModal({ type: "folder", id });
  const openEvidence = (i) => setModal({ type: "evidence", i });
  const openPaperTrail = (id) => {
    const n = board.nodes.find((x) => x.id === id);
    setModal({ type: "paper", id: n && n.versionsOf ? n.versionsOf : id });
  };
  const goto = (id) => { setModal(null); select(id); focusNode(id); };

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { setModal(null); setDrawerOpen(false); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const actions = {
    dig, focus: focusNode, openFolder, openPaperTrail, openEvidence, remove: removeNode, ask, goto, editNote,
    gotoRef: (id) => { select(id); focusNode(id); }, summaryRef,
  };
  const modalNode = modal && modal.id ? board.nodes.find((n) => n.id === modal.id) : null;
  const toggleView = (v) => setView((cur) => (cur === v ? "board" : v));

  return (
    <div id="app">
      <header className="topbar">
        <button className="icon-btn" aria-label="Open boards menu" title="Boards" onClick={() => setDrawerOpen(true)}>
          <svg viewBox="0 0 24 24" width="22" height="22"><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
        <div className="brand">
          <span className="brand-mark">paper trail</span>
          <span className="brand-sep">/</span>
          <input className="board-title" aria-label="Board title" spellCheck={false} value={board.title}
            onChange={(e) => updateBoard(board.id, (b) => ({ ...b, title: e.target.value }))} />
        </div>
        <div className="topbar-right">
          <span className="demo-chip" title="Riverton and everyone in it are fictional. Agents are simulated.">Illustrative concept · fictional data</span>
          <button className={"pill-btn" + (view === "analytics" ? " active" : "")} onClick={() => toggleView("analytics")}>
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" /></svg>
            <span>Analytics</span>
          </button>
          <button className="icon-btn" aria-label="Toggle Story File panel" title="Story File panel" onClick={() => setSidebarOpen((o) => !o)}>
            <svg viewBox="0 0 24 24" width="20" height="20"><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" fill="none" /><path d="M15 4v16" stroke="currentColor" strokeWidth="2" /></svg>
          </button>
        </div>
      </header>

      <main className="main">
        <section className="board-wrap" hidden={view !== "board"}>
          <Board ref={boardApi} board={board} selected={selected} hidden={hidden} drops={drops} freshStrings={fresh}
            onSelect={(id) => select(id)} onMoveEnd={moveNode} onOpenFolder={openFolder} onOpenEvidence={openEvidence}
            onToggleKind={(k) => setHidden((h) => (h.includes(k) ? h.filter((x) => x !== k) : [...h, k]))} />

          {board.nodes.length === 0 && (
            <div className="empty">
              <div className="empty-card">
                <div className="empty-stamp">NEW CASE</div>
                <h2>Every headline has a paper trail. Follow it.</h2>
                <p>Start with something you actually saw: a post you shared from Instagram, TikTok or X, or a screenshot. Ask Paper Trail a question and the detective agents will pin up the original documents, the people and money involved, what changed, and what's still unknown.</p>
                <div className="empty-inbox">{S.inbox.map((p) => <InboxItem key={p.id} p={p} onPick={pickInbox} />)}</div>
                <div className="empty-or">or just type a question ↓</div>
              </div>
            </div>
          )}

          {ticker && (
            <div className="ticker">
              {ticker.map((r, i) => (
                <div key={i} className={"ticker-row" + (r.done ? " done" : "")}>
                  <span className="ic">{r.done ? "✓" : <span className="spin" />}</span>{r.t}
                </div>
              ))}
            </div>
          )}

          <Composer ref={composer}
            placeholder={placeholder || (board.nodes.length ? "Ask Paper Trail a follow-up, or select a pin to dig into it…" : "Ask Paper Trail a question to open an investigation…")}
            context={selectedNode} onClearContext={() => setSelected(null)}
            attach={attach} setAttach={setAttach} onAsk={ask}
            onOpenInbox={() => setDrawerOpen(true)} onAddNote={addUserNote}
            trending={ticker ? [] : PT_DATA.trending.filter((t) => t.board !== board.id)} onTrending={openTrending} />
        </section>

        {view === "analytics" && (
          <section className="analytics">
            <Analytics boards={S.boards} onOpenBoard={switchBoard} />
          </section>
        )}

        {view === "board" && (
          <Sidebar board={board} selectedNode={selectedNode} tab={tab} setTab={setTab} open={sidebarOpen} actions={actions} />
        )}
      </main>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} boards={S.boards} activeId={S.activeId} inbox={S.inbox}
        onSwitch={switchBoard} onNew={newBoard} onPickInbox={pickInbox}
        onAnalytics={() => { setDrawerOpen(false); setView("analytics"); }} onReset={resetDemo} />

      {modal && modal.type === "folder" && modalNode && (
        <FolderModal n={modalNode} onClose={() => setModal(null)} onDig={() => { setModal(null); select(modalNode.id); runDig(S.activeId, modalNode.id, "Who funded this?"); }} />
      )}
      {modal && modal.type === "evidence" && board.strings[modal.i] && (
        <EvidenceModal board={board} s={board.strings[modal.i]} onClose={() => setModal(null)} onGo={goto} />
      )}
      {modal && modal.type === "paper" && modalNode && modalNode.versions && (
        <PaperTrailModal n={modalNode} onClose={() => setModal(null)} />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
