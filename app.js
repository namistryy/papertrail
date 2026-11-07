/* Papertrail prototype: vanilla JS, no build step.
   The "detective agents" are simulated: generation uses templates so the
   prototype works offline. Swap generateBoard()/digDeeper() for real calls later. */
(function () {
  "use strict";

  // ---------- constants ----------
  const STORE_KEY = "receipts_v1";
  const KINDS = {
    connects:    { label: "Connects / supports", color: "var(--s-connects)" },
    contradicts: { label: "Contradicts",         color: "var(--s-contradicts)" },
    money:       { label: "Money / funding",     color: "var(--s-money)" },
    verified:    { label: "Verified against",    color: "var(--s-verified)" },
    changed:     { label: "Changed / amended",   color: "var(--s-changed)" },
    origin:      { label: "Origin trail (repost)", color: "var(--s-origin)" },
  };
  const PIN = { post: "#c0392b", shot: "#c0392b", doc: "#2f6fd6", note: "#333", folder: "#d39a12", clip: "#1f9d55" };
  const VERDICT = {
    verified:    { label: "Verified",    icon: "✓" },
    partial:      { label: "Partially supported", short: "Partial", icon: "≈" },
    contradicted: { label: "Contradicted", icon: "✗" },
    unverified:  { label: "Unverified",  icon: "?" },
  };
  const AGENTS = {
    "Bias Hound":   { ic: "🐕", role: "Framing, loaded language, who benefits" },
    "Evidence Checker": { ic: "🔎", role: "Checks claims against primary sources" },
    "Tracer":       { ic: "🧭", role: "Follows reposts upstream & maps the money" },
    "You":          { ic: "✍️", role: "Your own note" },
  };
  const PLATFORMS = ["TikTok", "Instagram", "X"];

  // ---------- state ----------
  const clone = (o) => JSON.parse(JSON.stringify(o));
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) { const s = JSON.parse(raw); if (s && s.boards && s.boards.length) return s; }
    } catch (e) { /* ignore */ }
    return fresh();
  }
  function fresh() {
    const boards = clone(PT_DATA.boards);
    boards.forEach((b) => {
      b.qa = b.qa || [];
      b.log = b.log || [
        `Tracer followed ${b.nodes.filter((n) => n.type === "post").length} social posts upstream`,
        `Evidence Checker checked ${b.nodes.filter((n) => n.checks).length} sources against primary records`,
        `Bias Hound scored framing on every source`,
      ];
    });
    return { boards, inbox: clone(PT_DATA.inbox), activeId: boards[0].id };
  }
  let S = load();
  const ui = { selected: null, cam: { x: 0, y: 0, k: 0.6 }, hidden: new Set(), attach: null, busy: false, view: "board", tab: "summary" };
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); }
    catch (e) { toast("Couldn't save locally (storage full?), so changes only last this session"); }
  }
  const board = () => S.boards.find((b) => b.id === S.activeId) || S.boards[0];
  const nodeById = (id) => board().nodes.find((n) => n.id === id);
  const uid = (p) => p + Math.random().toString(36).slice(2, 8);

  // ---------- dom ----------
  const $ = (s) => document.querySelector(s);
  const el = {
    viewport: $("#viewport"), world: $("#world"), nodes: $("#nodes"), svg: $("#strings"),
    title: $("#boardTitle"), legend: $("#legend"), ticker: $("#ticker"), empty: $("#emptyState"),
    emptyInbox: $("#emptyInbox"), sidebar: $("#sidebar"), composer: $("#composer"), prompt: $("#prompt"),
    ctx: $("#composerContext"), attach: $("#attachPreview"), file: $("#fileInput"), plusMenu: $("#plusMenu"),
    drawer: $("#drawer"), scrim: $("#scrim"), boardList: $("#boardList"), drawerInbox: $("#drawerInbox"),
    modal: $("#modal"), modalCard: $("#modalCard"), toast: $("#toast"), stip: $("#stringTip"),
    analytics: $("#analytics"), boardWrap: $("#boardWrap"),
  };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let toastT;
  function toast(msg) {
    el.toast.textContent = msg; el.toast.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => (el.toast.hidden = true), 2600);
  }

  // ---------- card rendering ----------
  function badges(n) {
    if (!n.checks) return "";
    const c = n.checks, out = [];
    if (c.validity) {
      const v = VERDICT[c.validity.verdict] || VERDICT.unverified;
      out.push(`<span class="bdg" title="Evidence Checker"><span class="dot" style="background:var(--${statusVar(c.validity.verdict)})"></span>${v.icon} ${v.short || v.label}</span>`);
    }
    if (c.bias) {
      const l = c.bias.lean;
      const col = l < 0 ? "#2f7de0" : l > 0 ? "#d03b3b" : "#8a897f";
      out.push(`<span class="bdg" title="Bias Hound: ${esc(c.bias.label)}"><span class="dot" style="background:${col}"></span>${l === 0 ? "Neutral" : "Slanted"}</span>`);
    }
    if (c.origin && c.origin.chain) {
      const h = c.origin.chain.length;
      out.push(`<span class="bdg" title="Tracer">🧭 ${h === 1 ? "original" : h + " hops"}</span>`);
    }
    return `<div class="badges">${out.join("")}</div>`;
  }
  const statusVar = (v) => ({ verified: "good", partial: "warning", contradicted: "critical" }[v] || "neutral");

  function cardInner(n) {
    switch (n.type) {
      case "post":
        return `<div class="post-head"><span class="plat ${esc(n.platform)}">${esc(n.platform)}</span><span class="handle">${esc(n.handle)}</span></div>
          <div class="post-media ${esc(n.platform)}">${esc(n.title)}</div>
          <div class="post-foot"><span>${esc(n.date || "")}</span><span>${esc(n.stats || "")}</span></div>${badges(n)}`;
      case "shot":
        return `<div class="post-head"><span class="plat Upload">Screenshot</span><span class="handle">uploaded by you</span></div>
          <img src="${n.img}" alt="Uploaded screenshot" draggable="false" />
          <div class="post-foot"><span>${esc(n.date || "today")}</span><span>${esc(n.stats || "")}</span></div>${badges(n)}`;
      case "doc":
        return `${n.stamp ? `<span class="stamp" style="--stamp:${n.stamp === "AMENDED" ? "#7d3fb0" : n.stamp === "ORIGINAL" ? "#2f6fd6" : "#b8322a"}">${esc(n.stamp)}</span>` : ""}
          <h4 class="doc-title">${esc(n.title)}</h4><div class="doc-date">${esc(n.date || "")}</div>
          <div class="doc-body">${esc(n.body || "")}</div>${badges(n)}`;
      case "note":
        return `<div class="note-title">${esc(n.title)}</div><div class="note-body">${esc(n.body || "")}</div>
          <div class="note-agent">${n.agent && n.agent !== "You" ? "— " + esc(n.agent) + " agent" : n.agent === "You" ? "— you" : ""}</div>`;
      case "folder":
        return `<div class="folder-tab"></div><div class="folder-body"><div class="folder-peek"></div>
          <div class="folder-label">${esc(n.title)}</div>
          <div class="folder-meta"><span>${(n.files || []).length} files</span><button class="folder-open" data-open="${n.id}">Open folder</button></div>
          ${badges(n).replace('class="badges"', 'class="badges" style="margin-top:10px"')}</div>`;
      case "clip":
        return `<div class="clip-outlet">${esc(n.outlet || "Local news")} · ${esc(n.date || "")}</div>
          <div class="clip-title">${esc(n.title)}</div><div class="clip-body">${esc(n.body || "")}</div>${badges(n)}`;
    }
    return esc(n.title);
  }

  function makeCard(n, animate, delay) {
    const d = document.createElement("div");
    d.className = `card ${n.type} ${n.color || ""}` + (animate ? " drop" : "");
    d.dataset.id = n.id;
    d.style.left = n.x + "px"; d.style.top = n.y + "px"; d.style.width = (n.w || 230) + "px";
    d.style.setProperty("--rot", (n.rot || 0) + "deg");
    if (animate && delay) d.style.animationDelay = delay + "ms";
    d.innerHTML = `<span class="pin" style="--pin:${PIN[n.type] || "#c0392b"}"></span>` + cardInner(n);
    return d;
  }

  function renderBoard() {
    const b = board();
    el.title.value = b.title;
    el.nodes.innerHTML = "";
    b.nodes.forEach((n) => el.nodes.appendChild(makeCard(n)));
    drawStrings();
    el.empty.hidden = b.nodes.length > 0;
    if (!b.nodes.length) renderEmptyInbox();
    applyFocus();
    renderSidebar();
    renderDrawer();
    el.prompt.placeholder = b.nodes.length ? "Ask Receipts a follow-up, or select a pin to dig into it…" : "Ask Receipts a question to open an investigation…";
  }

  // ---------- strings ----------
  function pinPoint(n) { return { x: n.x + (n.w || 230) / 2, y: n.y + 2 }; }
  function pathFor(a, b) {
    const p1 = pinPoint(a), p2 = pinPoint(b);
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const sag = Math.min(140, 30 + dist * 0.12);
    const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2 + sag;
    return `M${p1.x},${p1.y} Q${mx},${my} ${p2.x},${p2.y}`;
  }
  function drawStrings(fresh) {
    const b = board();
    fresh = fresh || new Set();
    let html = "";
    b.strings.forEach((s, i) => {
      const a = nodeById(s.from), c = nodeById(s.to);
      if (!a || !c) return;
      const d = pathFor(a, c), k = KINDS[s.kind] || KINDS.connects;
      const hid = ui.hidden.has(s.kind) ? " hidden-kind" : "";
      const isNew = (fresh.has(i) ? " draw" : "") + (s.claimed ? " claimed" : "");
      html += `<path class="str-shadow${hid}" data-i="${i}" d="${d}"/>`;
      html += `<path class="str k-${s.kind}${hid}${isNew}" data-i="${i}" d="${d}" style="stroke:${k.color}"/>`;
      html += `<path class="hit${hid}" data-i="${i}" d="${d}" stroke="transparent" stroke-width="16" fill="none"/>`;
    });
    el.svg.innerHTML = html;
    el.svg.querySelectorAll(".str.draw").forEach((p) => p.style.setProperty("--len", Math.ceil(p.getTotalLength())));
  }
  function updateStringsFor(id) {
    const b = board();
    b.strings.forEach((s, i) => {
      if (s.from !== id && s.to !== id) return;
      const a = nodeById(s.from), c = nodeById(s.to);
      const d = pathFor(a, c);
      el.svg.querySelectorAll(`[data-i="${i}"]`).forEach((p) => { p.setAttribute("d", d); p.classList.remove("draw"); });
    });
  }

  // ---------- focus / selection ----------
  function neighbors(id) {
    const set = new Set([id]);
    board().strings.forEach((s) => { if (s.from === id) set.add(s.to); if (s.to === id) set.add(s.from); });
    return set;
  }
  function applyFocus() {
    const id = ui.selected;
    const has = !!id && !!nodeById(id);
    el.nodes.classList.toggle("has-focus", has);
    el.svg.classList.toggle("has-focus", has);
    const nb = has ? neighbors(id) : new Set();
    el.nodes.querySelectorAll(".card").forEach((c) => {
      c.classList.toggle("lit", nb.has(c.dataset.id));
      c.classList.toggle("selected", c.dataset.id === id);
    });
    const b = board();
    el.svg.querySelectorAll("path[data-i]").forEach((p) => {
      const s = b.strings[+p.dataset.i];
      p.classList.toggle("lit", has && s && (s.from === id || s.to === id));
    });
    // composer context chip
    if (has) {
      const n = nodeById(id);
      el.ctx.hidden = false;
      el.ctx.innerHTML = `<span>Asking about</span><b>${esc(shortTitle(n))}</b><button type="button" aria-label="Clear">✕</button>`;
      el.ctx.querySelector("button").onclick = () => select(null);
    } else el.ctx.hidden = true;
  }
  function shortTitle(n, len = 46) {
    const t = (n.type === "post" ? n.handle + ": " : "") + String(n.title || "").replace(/^"|"$/g, "");
    return t.length > len ? t.slice(0, len - 1) + "…" : t;
  }
  function select(id, opts = {}) {
    ui.selected = id;
    applyFocus();
    if (id) { setTab("inspect"); if (opts.open !== false) openSidebar(); }
    else renderInspect();
  }

  // ---------- camera ----------
  function applyCam() { el.world.style.transform = `translate(${ui.cam.x}px, ${ui.cam.y}px) scale(${ui.cam.k})`; }
  function animateCam(fn) {
    el.world.classList.add("animating"); fn(); applyCam();
    clearTimeout(animateCam.t); animateCam.t = setTimeout(() => el.world.classList.remove("animating"), 750);
  }
  function zoomAt(f, cx, cy) {
    const k0 = ui.cam.k, k = Math.max(0.2, Math.min(2.2, k0 * f));
    ui.cam.x = cx - (cx - ui.cam.x) * (k / k0);
    ui.cam.y = cy - (cy - ui.cam.y) * (k / k0);
    ui.cam.k = k;
  }
  function bboxOf(ids) {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    el.nodes.querySelectorAll(".card").forEach((c) => {
      if (ids && !ids.has(c.dataset.id)) return;
      const x = c.offsetLeft, y = c.offsetTop, w = c.offsetWidth, h = c.offsetHeight;
      x1 = Math.min(x1, x); y1 = Math.min(y1, y - 12); x2 = Math.max(x2, x + w); y2 = Math.max(y2, y + h);
    });
    return isFinite(x1) ? { x1, y1, x2, y2 } : null;
  }
  function fitTo(ids, maxK = 1.1, animate = true) {
    const bb = bboxOf(ids);
    const vw = el.viewport.clientWidth, vh = el.viewport.clientHeight;
    if (!bb) { ui.cam = { x: vw / 2 - 1150 * 0.6, y: vh / 2 - 650 * 0.6, k: 0.6 }; applyCam(); return; }
    const padX = 60, padTop = 70, padBot = 110;
    const k = Math.max(0.2, Math.min(maxK, (vw - padX * 2) / (bb.x2 - bb.x1), (vh - padTop - padBot) / (bb.y2 - bb.y1)));
    const set = () => {
      ui.cam.k = k;
      ui.cam.x = (vw - (bb.x2 - bb.x1) * k) / 2 - bb.x1 * k;
      ui.cam.y = padTop + (vh - padTop - padBot - (bb.y2 - bb.y1) * k) / 2 - bb.y1 * k;
    };
    animate ? animateCam(set) : (set(), applyCam());
  }
  const focusNode = (id) => fitTo(new Set([id]), 1.5);

  // ---------- pointer interactions on board ----------
  let drag = null;
  el.viewport.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    if (e.target.closest("[data-open]")) return;
    const card = e.target.closest(".card");
    el.plusMenu.hidden = true;
    if (card) {
      const n = nodeById(card.dataset.id);
      drag = { mode: "card", id: n.id, sx: e.clientX, sy: e.clientY, nx: n.x, ny: n.y, el: card, moved: false };
    } else {
      const hit = e.target.closest(".hit");
      drag = { mode: "pan", sx: e.clientX, sy: e.clientY, cx: ui.cam.x, cy: ui.cam.y, moved: false, hit: hit ? +hit.dataset.i : null };
      el.viewport.classList.add("panning");
    }
    el.viewport.setPointerCapture(e.pointerId);
  });
  el.viewport.addEventListener("pointermove", (e) => {
    if (!drag) return hoverString(e);
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    if (drag.mode === "pan") { ui.cam.x = drag.cx + dx; ui.cam.y = drag.cy + dy; applyCam(); }
    else {
      const n = nodeById(drag.id);
      n.x = Math.round(drag.nx + dx / ui.cam.k); n.y = Math.round(drag.ny + dy / ui.cam.k);
      drag.el.style.left = n.x + "px"; drag.el.style.top = n.y + "px";
      drag.el.classList.add("dragging");
      updateStringsFor(n.id);
    }
  });
  el.viewport.addEventListener("pointerup", () => {
    if (!drag) return;
    el.viewport.classList.remove("panning");
    if (drag.mode === "card") {
      drag.el.classList.remove("dragging");
      if (drag.moved) save(); else select(drag.id === ui.selected ? null : drag.id);
    } else if (!drag.moved && drag.hit != null) { el.stip.hidden = true; openEvidence(drag.hit); }
    else if (!drag.moved && ui.selected) select(null);
    drag = null;
  });
  el.viewport.addEventListener("dblclick", (e) => {
    const card = e.target.closest(".card");
    if (card) { select(card.dataset.id); focusNode(card.dataset.id); }
  });
  el.viewport.addEventListener("click", (e) => {
    const o = e.target.closest("[data-open]");
    if (o) openFolder(o.dataset.open);
  });
  el.viewport.addEventListener("wheel", (e) => {
    e.preventDefault();
    const r = el.viewport.getBoundingClientRect();
    zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    applyCam();
  }, { passive: false });
  function hoverString(e) {
    const h = e.target.closest && e.target.closest(".hit");
    if (!h) { el.stip.hidden = true; return; }
    const s = board().strings[+h.dataset.i];
    if (!s) return;
    const a = nodeById(s.from), c = nodeById(s.to);
    el.stip.hidden = false;
    el.stip.innerHTML = `<b style="color:${KINDS[s.kind].color}">●</b> ${esc(KINDS[s.kind].label)}: <b>${esc(s.label || "")}</b><br><span class="muted">${esc(shortTitle(a, 30))} → ${esc(shortTitle(c, 30))}</span>`;
    el.stip.style.left = e.clientX + 14 + "px"; el.stip.style.top = e.clientY + 14 + "px";
  }
  el.viewport.addEventListener("pointerleave", () => (el.stip.hidden = true));
  $("#zoomIn").onclick = () => animateCam(() => zoomAt(1.25, el.viewport.clientWidth / 2, el.viewport.clientHeight / 2));
  $("#zoomOut").onclick = () => animateCam(() => zoomAt(0.8, el.viewport.clientWidth / 2, el.viewport.clientHeight / 2));
  $("#zoomFit").onclick = () => fitTo(null);

  // ---------- legend ----------
  function renderLegend() {
    el.legend.innerHTML = `<div class="legend-title"><span>String key</span><button id="legendToggle">hide</button></div>` +
      Object.entries(KINDS).map(([k, v]) => `<button class="legend-row ${ui.hidden.has(k) ? "off" : ""}" data-kind="${k}" title="Show/hide these strings">
        <svg width="26" height="8"><path d="M1 4 Q13 9 25 4" stroke="${v.color}" stroke-width="2.4" fill="none" ${k === "origin" ? 'stroke-dasharray="4 3"' : ""}/></svg>${v.label}</button>`).join("") +
      `<div class="legend-row" style="cursor:default"><svg width="26" height="8"><path d="M1 4 Q13 9 25 4" stroke="var(--ink-2)" stroke-width="3" fill="none" stroke-dasharray="1.5 5" stroke-linecap="round"/></svg>Claimed, not documented</div>
      <div class="legend-row" style="cursor:default;color:var(--ink-3);font-size:11px">Tap a string to see its evidence</div>`;
    el.legend.querySelectorAll("[data-kind]").forEach((b) => (b.onclick = () => {
      const k = b.dataset.kind; ui.hidden.has(k) ? ui.hidden.delete(k) : ui.hidden.add(k);
      renderLegend(); drawStrings(); applyFocus();
    }));
    $("#legendToggle").onclick = () => {
      el.legend.classList.toggle("collapsed");
      $("#legendToggle").textContent = el.legend.classList.contains("collapsed") ? "show" : "hide";
    };
  }
  if (window.innerWidth < 600) el.legend.classList.add("collapsed");

  // ---------- sidebar ----------
  function openSidebar() { el.sidebar.classList.remove("closed"); }
  $("#sidebarToggle").onclick = () => el.sidebar.classList.toggle("closed");
  document.querySelectorAll(".tab").forEach((t) => (t.onclick = () => setTab(t.dataset.tab)));
  function setTab(tab) {
    ui.tab = tab;
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
    ["summary", "inspect", "agents"].forEach((k) => ($("#tab-" + k).hidden = k !== tab));
    renderSidebar();
  }
  function renderSidebar() {
    if (ui.tab === "summary") renderSummary();
    else if (ui.tab === "inspect") renderInspect();
    else renderAgents();
  }
  function refText(text) {
    const b = board();
    return esc(text).replace(/\[\[([\w-]+)\]\]/g, (_, id) => {
      const i = b.nodes.findIndex((n) => n.id === id);
      return i < 0 ? "" : `<button class="ref" data-ref="${id}" title="${esc(shortTitle(b.nodes[i]))}">${i + 1}</button>`;
    });
  }
  function wireRefs(root) {
    root.querySelectorAll("[data-ref]").forEach((r) => (r.onclick = () => { const id = r.dataset.ref; select(id, { open: true }); focusNode(id); }));
  }
  function renderSummary() {
    const b = board(), root = $("#tab-summary");
    if (!b.nodes.length) {
      root.innerHTML = `<div class="empty-insp"><div class="big">🗂️</div>No case file yet.<br>Ask a question below and a written summary will build here alongside the board, for when the strings get overwhelming.</div>`;
      return;
    }
    const sources = b.nodes.filter((n) => n.type !== "note").length;
    const docd = b.strings.filter((x) => !x.claimed).length;
    root.innerHTML = `<div class="sf-kicker">Story File${b.category ? " · " + esc(b.category) : ""}${b.location ? " · " + esc(b.location) : ""}</div>
      <div class="sum-q">${esc(b.question || b.title)}</div>
      <div class="sum-meta">${sources} sources · ${docd} documented connections · ${b.strings.length - docd} claimed. Read it here as text if the board gets to be too much. The numbers jump to the pin.</div>
      ${(b.summary || []).map((s) => `<div class="sum-sec"><h3>${esc(s.h)}</h3><p>${refText(s.p)}</p></div>`).join("")}
      ${b.timeline && b.timeline.length ? `<div class="sum-sec"><h3>Timeline</h3><ol class="tl">${b.timeline.map((t) => `<li><span class="tl-d">${esc(t.d)}</span><span>${esc(t.t)} ${t.ref ? refText("[[" + t.ref + "]]") : ""}</span></li>`).join("")}</ol></div>` : ""}
      ${(b.qa || []).length ? `<div class="sum-sec"><h3>Ask Receipts</h3></div>` : ""}
      ${(b.qa || []).map((q) => `<div class="qa"><div class="qa-q">${esc(q.q)}</div><p>${refText(q.a)}</p><div class="qa-src">Answered only from sources on this board</div></div>`).join("")}`;
    wireRefs(root);
  }
  function renderInspect() {
    const root = $("#tab-inspect");
    const n = ui.selected && nodeById(ui.selected);
    if (!n) {
      root.innerHTML = `<div class="empty-insp"><div class="big">📌</div>Tap any pin on the board to inspect it.<br>You'll see what each detective agent found, and you can dig deeper to grow a sub-board of related sources.</div>`;
      return;
    }
    const typeName = { post: n.platform + " post", shot: "Your screenshot", doc: "Document", note: "Sticky note", folder: "Folder", clip: "News clipping" }[n.type];
    const conns = board().strings.filter((s) => s.from === n.id || s.to === n.id);
    let html = `<div class="insp-type">${esc(typeName)}${n.handle ? " · " + esc(n.handle) : ""}${n.date ? " · " + esc(n.date) : ""}</div>
      <h2 class="insp-title">${esc(n.title)}</h2>`;
    if (n.type === "note" && n.agent === "You") {
      html += `<textarea id="noteEdit" class="btn" style="width:100%;min-height:90px;resize:vertical;font:15px var(--font-ui);text-align:left">${esc(n.body)}</textarea>`;
    } else if (n.body) html += `<div class="insp-body">${esc(n.body)}</div>`;
    if (n.type === "shot") html += `<img src="${n.img}" alt="" style="width:100%;border-radius:8px;margin-bottom:8px"/>`;
    if (n.files) html += `<div class="insp-body">${n.files.map((f) => `• <b>${esc(f.t)}</b>: ${esc(f.d)}`).join("\n")}</div>`;
    if (n.agent === "You" || n.type === "shot") html += `<div class="pending">⏳ Your addition. It goes to review before it joins the reviewed Story File.</div>`;
    if ((n.type === "post" || n.type === "shot") && n.checks) html += claimProfile(n);
    html += `<div class="insp-actions">
        <button class="btn primary" id="digBtn">🧵 Dig deeper</button>
        <button class="btn" id="zoomBtn">🔍 Zoom in</button>
        ${n.type === "folder" ? `<button class="btn" id="openBtn">📂 Open</button>` : ""}
        ${n.versions || n.versionsOf ? `<button class="btn" id="ptBtn">📜 Paper Trail</button>` : ""}
        <button class="btn" id="rmBtn" title="Remove from board">🗑</button>
      </div>
      <div class="chips">${followUps(n).map((q) => `<button class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join("")}</div>`;
    if (n.checks) {
      const c = n.checks;
      html += `<div class="drawer-label" style="margin:4px 0 10px">Detective agents</div>`;
      if (c.validity) {
        const v = VERDICT[c.validity.verdict] || VERDICT.unverified;
        html += agentCard("Evidence Checker", `<span class="verdict ${c.validity.verdict}">${v.icon} ${v.label}</span><p>${esc(c.validity.note)}</p>`);
      }
      if (c.bias) {
        const pct = ((c.bias.lean + 2) / 4) * 100;
        html += agentCard("Bias Hound", `<b>${esc(c.bias.label)}</b>
          <div class="lean" role="img" aria-label="Slant ${c.bias.lean} on a scale of -2 to 2"><span class="lean-mark" style="left:${pct}%"></span></div>
          <div class="lean-scale"><span>Strongly for</span><span>Neutral</span><span>Strongly against</span></div>
          <p>${esc(c.bias.note)}</p>`);
      }
      if (c.origin) {
        html += agentCard("Tracer", `<b>Where it came from</b><ul class="chain">${c.origin.chain.map((x) => `<li>${esc(x)}</li>`).join("")}</ul><p style="margin-top:0">${esc(c.origin.note)}</p>`);
      }
    } else if (n.agent && n.agent !== "You") {
      html += `<p class="muted">Written by the ${esc(n.agent)} agent.</p>`;
    }
    if (conns.length) {
      html += `<div class="drawer-label" style="margin:16px 0 6px">Strings (${conns.length})</div>`;
      html += conns.map((s) => {
        const other = nodeById(s.from === n.id ? s.to : s.from);
        return other ? `<button class="board-item" data-goto="${other.id}"><span class="sw" style="background:${KINDS[s.kind].color};margin-top:5px"></span><span><span class="t">${esc(shortTitle(other, 52))}</span><span class="m" style="display:block">${esc(s.label || KINDS[s.kind].label)}</span></span></button>` : "";
      }).join("");
    }
    root.innerHTML = html;
    $("#digBtn").onclick = () => digDeeper(n, null);
    $("#zoomBtn").onclick = () => focusNode(n.id);
    if ($("#openBtn")) $("#openBtn").onclick = () => openFolder(n.id);
    if ($("#ptBtn")) $("#ptBtn").onclick = () => openPaperTrail(n.id);
    root.querySelectorAll("[data-goto2]").forEach((c) => (c.onclick = () => { select(c.dataset.goto2); focusNode(c.dataset.goto2); }));
    $("#rmBtn").onclick = () => removeNode(n.id);
    root.querySelectorAll("[data-q]").forEach((c) => (c.onclick = () => ask(c.dataset.q)));
    root.querySelectorAll("[data-goto]").forEach((c) => (c.onclick = () => { select(c.dataset.goto); focusNode(c.dataset.goto); }));
    const ne = $("#noteEdit");
    if (ne) ne.oninput = () => {
      n.body = ne.value; save();
      const card = el.nodes.querySelector(`[data-id="${n.id}"] .note-body`); if (card) card.textContent = n.body;
    };
  }
  function claimProfile(n) {
    const b = board(), c = n.checks;
    const ev = b.strings.filter((x) => (x.from === n.id || x.to === n.id) && (x.kind === "verified" || x.kind === "contradicts"))
      .map((x) => nodeById(x.from === n.id ? x.to : x.from)).filter(Boolean);
    const v = VERDICT[c.validity ? c.validity.verdict : "unverified"];
    const row = (k, val) => `<tr><th>${k}</th><td>${val}</td></tr>`;
    return `<table class="claim-tbl"><caption>Claim vs. Evidence</caption>
      ${row("Claim", esc(String(n.title).replace(/^"|"$/g, "")))}
      ${row("Source", esc(n.handle || "Uploaded screenshot") + (n.platform && n.platform !== "Upload" ? " on " + esc(n.platform) : ""))}
      ${row("Evidence", ev.length ? ev.map((o) => `<button class="link-btn inline" data-goto2="${o.id}">${esc(shortTitle(o, 40))}</button>`).join("<br>") : `<span class="muted">No documentation linked yet</span>`)}
      ${row("Context", esc(c.context || "Agents flag what's missing. Dig deeper to fill the gaps."))}
      ${row("Status", `<span class="verdict ${c.validity ? c.validity.verdict : "unverified"}">${v.icon} ${v.label}</span><div class="muted" style="font-size:11.5px;margin-top:4px">based on available evidence</div>`)}
    </table>`;
  }

  function openEvidence(i) {
    const b = board(), s = b.strings[i];
    if (!s) return;
    const a = nodeById(s.from), c = nodeById(s.to), k = KINDS[s.kind];
    const docNode = [a, c].find((x) => x && x.checks && x.checks.validity && x.checks.validity.verdict === "verified") || a;
    const ev = s.ev || (docNode && docNode.checks && docNode.checks.origin ? "Documented in: " + docNode.checks.origin.chain.join(" → ") : "Connection drawn by the agents from the linked sources.");
    el.modalCard.className = "modal-card paper";
    el.modalCard.innerHTML = `<button class="close" aria-label="Close">✕</button>
      <div class="sf-kicker" style="color:#8a7d6c">Evidence behind this string</div>
      <h3 style="display:flex;gap:10px;align-items:center"><svg width="34" height="10"><path d="M1 5 Q17 11 33 5" stroke="${k.color}" stroke-width="3" fill="none" ${s.claimed ? 'stroke-dasharray="2 5"' : s.kind === "origin" ? 'stroke-dasharray="5 4"' : ""}/></svg>${esc(k.label)}</h3>
      <div class="ev-route"><button class="ev-node" data-go="${a.id}">${esc(shortTitle(a, 50))}</button><span class="ev-arrow">→ ${esc(s.label || "")} →</span><button class="ev-node" data-go="${c.id}">${esc(shortTitle(c, 50))}</button></div>
      <div class="ev-status ${s.claimed ? "claimed" : "doc"}">${s.claimed ? "⚠ Claimed connection, not documented" : "✓ Documented connection"}</div>
      <p class="ev-text">${esc(ev)}</p>
      ${s.kind === "money" && !s.claimed ? `<p class="ev-note">A disclosed contribution is a documented fact. It doesn't, by itself, establish that the money influenced a decision.</p>` : ""}`;
    el.modal.hidden = false;
    el.modalCard.querySelector(".close").onclick = closeModal;
    el.modalCard.querySelectorAll("[data-go]").forEach((x) => (x.onclick = () => { closeModal(); select(x.dataset.go); focusNode(x.dataset.go); }));
  }

  function wordDiff(a, b) {
    const A = a.split(" "), B = b.split(" ");
    const m = A.length, n = B.length, L = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    let i = 0, j = 0, out = [];
    while (i < m && j < n) {
      if (A[i] === B[j]) { out.push(esc(A[i])); i++; j++; }
      else if (L[i + 1][j] >= L[i][j + 1]) out.push(`<del>${esc(A[i++])}</del>`);
      else out.push(`<ins>${esc(B[j++])}</ins>`);
    }
    while (i < m) out.push(`<del>${esc(A[i++])}</del>`);
    while (j < n) out.push(`<ins>${esc(B[j++])}</ins>`);
    return out.join(" ").replace(/<\/del> <del>/g, " ").replace(/<\/ins> <ins>/g, " ");
  }
  function openPaperTrail(id, idx, base) {
    let n = nodeById(id);
    if (n && n.versionsOf) n = nodeById(n.versionsOf);
    if (!n || !n.versions) return;
    const V = n.versions;
    idx = idx == null ? V.length - 1 : idx;
    base = base || "prev";
    const cur = V[idx], prev = idx === 0 ? null : base === "orig" ? V[0] : V[idx - 1];
    let changes = 0;
    const lines = cur.clauses.map((cl) => {
      const old = prev && prev.clauses.find((x) => x.k === cl.k);
      if (!prev) return `<li>${esc(cl.t)}</li>`;
      if (!old) { changes++; return `<li class="added"><span class="tag">added</span><ins>${esc(cl.t)}</ins></li>`; }
      if (old.t !== cl.t) { changes++; return `<li class="changed"><span class="tag">changed</span>${wordDiff(old.t, cl.t)}</li>`; }
      return `<li class="same">${esc(cl.t)}</li>`;
    });
    if (prev) prev.clauses.forEach((cl) => { if (!cur.clauses.find((x) => x.k === cl.k)) { changes++; lines.push(`<li class="removed"><span class="tag">removed</span><del>${esc(cl.t)}</del></li>`); } });
    el.modalCard.className = "modal-card paper wide";
    el.modalCard.innerHTML = `<button class="close" aria-label="Close">✕</button>
      <div class="sf-kicker" style="color:#8a7d6c">Paper Trail · how the decision changed</div>
      <h3>${esc(n.title.replace(/ — Final$/, ""))}</h3>
      <div class="pt-steps">${V.map((v, i) => `<button class="pt-step ${i === idx ? "on" : ""}" data-v="${i}"><b>${esc(v.v)}</b><span>${esc(v.d)}</span></button>`).join('<span class="pt-line"></span>')}</div>
      ${idx > 0 ? `<div class="pt-base">Compare with: <button class="${base === "prev" ? "on" : ""}" data-base="prev">previous version</button><button class="${base === "orig" ? "on" : ""}" data-base="orig">original</button></div>` : ""}
      <div class="pt-why"><b>${esc(cur.v)} · ${esc(cur.d)}:</b> ${esc(cur.why)} ${prev ? `<span class="muted-ink">${changes} change${changes === 1 ? "" : "s"} vs. ${base === "orig" ? "original" : "previous"}.</span>` : ""}</div>
      <ol class="pt-text">${lines.join("")}</ol>
      <p class="ev-note">Text shown is the actual clause language from each version on file with the City Clerk (fictional demo).</p>`;
    el.modal.hidden = false;
    el.modalCard.querySelector(".close").onclick = closeModal;
    el.modalCard.querySelectorAll("[data-v]").forEach((x) => (x.onclick = () => openPaperTrail(n.id, +x.dataset.v, base)));
    el.modalCard.querySelectorAll("[data-base]").forEach((x) => (x.onclick = () => openPaperTrail(n.id, idx, x.dataset.base)));
  }

  function agentCard(name, inner) {
    const a = AGENTS[name];
    return `<div class="agent-card"><div class="agent-head"><span class="agent-ava">${a.ic}</span><div><div class="agent-name">${name}</div><div class="agent-role">${a.role}</div></div></div>${inner}</div>`;
  }
  function followUps(n) {
    if (n.type === "post" || n.type === "shot") return ["Who posted this first?", "Is this claim true?", "Who's behind this account?"];
    if (n.type === "folder") return ["Who funded this?", "Any conflicts of interest?"];
    if (n.type === "doc") return ["What changed from the original?", "Who introduced this?", "Explain it simply"];
    if (n.type === "clip") return ["Is this outlet biased?", "What did they leave out?"];
    return ["Find more sources on this", "Is this verified?"];
  }
  function renderAgents() {
    const b = board(), root = $("#tab-agents");
    const checked = b.nodes.filter((n) => n.checks);
    const cnt = (v) => checked.filter((n) => n.checks.validity && n.checks.validity.verdict === v).length;
    const slanted = checked.filter((n) => n.checks.bias && n.checks.bias.lean !== 0).length;
    const hops = checked.filter((n) => n.checks.origin).map((n) => n.checks.origin.chain.length);
    const avg = hops.length ? (hops.reduce((a, c) => a + c, 0) / hops.length).toFixed(1) : "–";
    root.innerHTML = `<p class="muted" style="margin-top:0">Three detective agents work every board. Each one stamps its findings on the pins and writes sticky notes when something's off.</p>
      <div class="agent-roster">
      ${agentCard("Evidence Checker", `<p>Builds an evidence profile for every claim (claim, source, evidence, missing context, status) from primary sources. It isn't a true/false meter: predictions and value judgments get labelled as such.</p><div class="stat">This board: ✓ ${cnt("verified")} verified · ≈ ${cnt("partial")} partial · ✗ ${cnt("contradicted")} contradicted · ? ${cnt("unverified")} unverified</div>`)}
      ${agentCard("Bias Hound", `<p>Scores framing and loaded language, and flags undisclosed sponsorships and who benefits.</p><div class="stat">This board: ${slanted} of ${checked.length} sources slanted</div>`)}
      ${agentCard("Tracer", `<p>Follows reposts and stitches back to the original source, and follows money through public finance records.</p><div class="stat">This board: avg ${avg} hops from original</div>`)}
      </div>
      <div class="drawer-label" style="margin:18px 0 8px">Activity log</div>
      ${(b.log || []).slice().reverse().map((l) => `<div class="ticker-row done" style="animation:none"><span class="ic">✓</span>${esc(l)}</div>`).join("") || `<p class="muted">Nothing yet.</p>`}`;
  }

  // ---------- folder modal ----------
  function openFolder(id) {
    const n = nodeById(id);
    if (!n) return;
    el.modalCard.className = "modal-card";
    el.modalCard.innerHTML = `<button class="close" aria-label="Close">✕</button><h3>${esc(n.title)}</h3>
      <div style="font-size:13px;opacity:.75">${(n.files || []).length} documents · ${esc(n.checks ? n.checks.origin.chain.join(" · ") : "")}</div>
      <div class="files">${(n.files || []).map((f, i) => `<div class="file" style="animation-delay:${i * 70}ms"><b>${esc(f.t)}</b><span>${esc(f.d)}</span></div>`).join("")}</div>
      <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="mDig" style="background:#3f2f14;color:#f6e7c8;border-color:#3f2f14">🧵 Pin these as separate sources</button></div>`;
    el.modal.hidden = false;
    el.modalCard.querySelector(".close").onclick = closeModal;
    $("#mDig").onclick = () => { closeModal(); select(n.id); digDeeper(n, "Who funded this?"); };
  }
  function closeModal() { el.modal.hidden = true; }
  el.modal.addEventListener("click", (e) => { if (e.target === el.modal) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeModal(); closeDrawer(); el.plusMenu.hidden = true; } });

  // ---------- drawer ----------
  function openDrawer() { renderDrawer(); el.drawer.classList.add("open"); el.scrim.hidden = false; }
  function closeDrawer() { el.drawer.classList.remove("open"); el.scrim.hidden = true; }
  $("#menuBtn").onclick = openDrawer;
  $("#drawerClose").onclick = closeDrawer;
  el.scrim.onclick = closeDrawer;
  function renderDrawer() {
    el.boardList.innerHTML = S.boards.map((b) => {
      const src = b.nodes.filter((n) => n.type !== "note").length;
      const bits = [0, 1, 2].map((i) => `<i style="left:${4 + i * 9}px;top:${6 + (i % 2) * 14}px;transform:rotate(${i * 9 - 8}deg)"></i>`).join("");
      return `<button class="board-item ${b.id === S.activeId ? "active" : ""}" data-b="${b.id}"><span class="thumb">${b.nodes.length ? bits : ""}</span><span><div class="t">${esc(b.title)}</div><div class="m">${src} sources · ${b.strings.length} strings</div></span></button>`;
    }).join("");
    el.boardList.querySelectorAll("[data-b]").forEach((x) => (x.onclick = () => { switchBoard(x.dataset.b); closeDrawer(); }));
    $("#inboxCount").textContent = S.inbox.length || "";
    el.drawerInbox.innerHTML = inboxHTML() || `<p class="muted" style="padding:0 6px">Share a post from Instagram, TikTok or X to Papertrail and it lands here.</p>`;
    wireInbox(el.drawerInbox, true);
  }
  function inboxHTML() {
    return S.inbox.map((p) => `<button class="inbox-item" data-inbox="${p.id}"><span class="row"><span class="plat ${p.platform}">${p.platform}</span>${esc(p.handle)} · ${esc(p.date)}</span>${esc(p.title)}</button>`).join("");
  }
  function wireInbox(root, fromDrawer) {
    root.querySelectorAll("[data-inbox]").forEach((x) => (x.onclick = () => { if (fromDrawer) closeDrawer(); pickInbox(x.dataset.inbox); }));
  }
  function renderEmptyInbox() { el.emptyInbox.innerHTML = inboxHTML(); wireInbox(el.emptyInbox); }
  $("#newBoardBtn").onclick = () => { newBoard(); closeDrawer(); };
  $("#drawerAnalytics").onclick = () => { closeDrawer(); showAnalytics(true); };
  $("#drawerDiscover").onclick = () => { closeDrawer(); showView("discover"); };
  $("#resetDemo").onclick = () => {
    S = fresh(); save(); ui.selected = null; closeDrawer(); showAnalytics(false); renderBoard(); requestAnimationFrame(() => fitTo(null, 1.1, false)); toast("Demo data reset");
  };

  function switchBoard(id) {
    S.activeId = id; ui.selected = null; save();
    showAnalytics(false); renderBoard();
    requestAnimationFrame(() => fitTo(null, 1.1, false));
  }
  function newBoard(seedPost) {
    const b = { id: uid("b-"), title: "Untitled board", question: "", created: new Date().toISOString().slice(0, 10), nodes: [], strings: [], summary: [], qa: [], log: [] };
    S.boards.unshift(b);
    switchBoard(b.id);
    if (seedPost) pinSeed(seedPost);
    el.prompt.focus();
    return b;
  }

  // ---------- inbox / uploads / notes ----------
  function postNodeFrom(p, x, y) {
    return { id: uid("n"), type: "post", platform: p.platform, handle: p.handle, title: p.title, date: p.date, stats: p.stats, x, y, w: 230, rot: +(Math.random() * 4 - 2).toFixed(1), seed: true, platformOrig: p.platform };
  }
  function centerWorld() {
    const vw = el.viewport.clientWidth, vh = el.viewport.clientHeight;
    return { x: (vw / 2 - ui.cam.x) / ui.cam.k, y: (vh / 2 - ui.cam.y) / ui.cam.k };
  }
  function pickInbox(id) {
    const p = S.inbox.find((x) => x.id === id);
    if (!p) return;
    showAnalytics(false);
    S.inbox = S.inbox.filter((x) => x.id !== id);
    pinSeed(p);
  }
  function pinSeed(p) {
    const b = board();
    const empty = !b.nodes.length;
    const c = empty ? { x: 1150, y: 600 } : freeSpot();
    const n = postNodeFrom(p, Math.round(c.x - 115), Math.round(c.y - 120));
    b.nodes.push(n);
    if (empty && b.title === "Untitled board") b.title = p.handle + " post";
    save(); renderBoard();
    el.nodes.querySelector(`[data-id="${n.id}"]`).classList.add("drop");
    if (empty) requestAnimationFrame(() => fitTo(new Set([n.id]), 1.2));
    else focusNode(n.id);
    select(n.id, { open: false });
    el.prompt.placeholder = "What do you want to know about this post?";
    el.prompt.focus();
    toast("Pinned to the board. Now ask a question about it.");
  }
  function freeSpot() {
    const bb = bboxOf();
    return bb ? { x: bb.x2 + 220, y: (bb.y1 + bb.y2) / 2 } : { x: 1150, y: 600 };
  }

  $("#plusBtn").onclick = (e) => { e.stopPropagation(); el.plusMenu.hidden = !el.plusMenu.hidden; };
  document.addEventListener("click", (e) => { if (!e.target.closest(".plus-wrap")) el.plusMenu.hidden = true; });
  el.plusMenu.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]") && e.target.closest("[data-act]").dataset.act;
    el.plusMenu.hidden = true;
    if (act === "upload") el.file.click();
    if (act === "inbox") openDrawer();
    if (act === "note") addUserNote();
  });
  el.file.addEventListener("change", () => {
    const f = el.file.files[0];
    el.file.value = "";
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 520, s = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement("canvas");
        cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        ui.attach = { img: cv.toDataURL("image/jpeg", 0.72), name: f.name };
        renderAttach();
        el.prompt.focus();
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(f);
  });
  function renderAttach() {
    if (!ui.attach) { el.attach.hidden = true; return; }
    el.attach.hidden = false;
    el.attach.innerHTML = `<img src="${ui.attach.img}" alt=""/><b>${esc(ui.attach.name)}</b><span class="muted">will be pinned when you send</span><button type="button" aria-label="Remove">✕</button>`;
    el.attach.querySelector("button").onclick = () => { ui.attach = null; renderAttach(); };
  }
  function addUserNote() {
    const b = board(), c = centerWorld();
    const text = el.prompt.value.trim();
    const n = { id: uid("n"), type: "note", color: "yellow", agent: "You", title: "MY NOTE", body: text || "Tap to edit in the Inspect panel", x: Math.round(c.x - 105), y: Math.round(c.y - 80), w: 210, rot: -2 };
    if (text) el.prompt.value = "";
    b.nodes.push(n); save(); renderBoard();
    el.nodes.querySelector(`[data-id="${n.id}"]`).classList.add("drop");
    select(n.id);
  }

  // ---------- composer ----------
  el.composer.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = el.prompt.value.trim();
    if (!q && !ui.attach) { el.prompt.focus(); return; }
    ask(q || "What's the real story behind this?");
  });

  async function ask(q) {
    if (ui.busy) return toast("The agents are still working…");
    showAnalytics(false);
    el.prompt.value = "";
    const b = board();
    let target = ui.selected && nodeById(ui.selected);
    if (ui.attach) {
      const c = b.nodes.length ? freeSpot() : { x: 1150, y: 600 };
      const n = shotNode(ui.attach, Math.round(c.x - 120), Math.round(c.y - 140));
      ui.attach = null; renderAttach();
      b.nodes.push(n);
      if (b.title === "Untitled board") b.title = "Screenshot investigation";
      renderBoard();
      el.nodes.querySelector(`[data-id="${n.id}"]`).classList.add("drop");
      target = n;
      if (b.nodes.length === 1) requestAnimationFrame(() => fitTo(new Set([n.id]), 1.1));
    }
    if (b.strings.length === 0) return generateBoard(b, q, b.nodes.find((n) => n.seed || n.type === "shot"));
    if (!target) target = b.nodes.find((n) => n.seed) || b.nodes[0];
    return digDeeper(target, q);
  }

  function shotNode(att, x, y) {
    return {
      id: uid("n"), type: "shot", img: att.img, platform: "Upload", title: "Your screenshot: " + att.name, date: "today", stats: "", x, y, w: 240, rot: 1.5, seed: true,
      checks: {
        bias: { lean: 1, label: "Mild slant", note: "Text pulled from the image (simulated OCR) uses urgency cues like \"BREAKING\", \"nobody's talking about it\"." },
        validity: { verdict: "unverified", note: "The screenshot has no link. Agents matched its text to 3 public posts but couldn't confirm the original." },
        origin: { chain: ["Screenshot uploaded by you · today", "Closest text match: a TikTok repost (simulated)", "Earliest match: an X post 6 days earlier (simulated)"], note: "Screenshots strip the original link, so Tracer reconstructs the chain by matching text." },
      },
    };
  }

  // ---------- agent ticker ----------
  async function runTicker(steps) {
    el.ticker.hidden = false; el.ticker.innerHTML = "";
    for (const s of steps) {
      const row = document.createElement("div");
      row.className = "ticker-row";
      row.innerHTML = `<span class="ic"><span class="spin"></span></span>${esc(s)}`;
      el.ticker.appendChild(row);
      await sleep(520 + Math.random() * 300);
      row.classList.add("done"); row.querySelector(".ic").textContent = "✓";
    }
    await sleep(250);
  }
  function hideTicker() { setTimeout(() => (el.ticker.hidden = true), 900); }

  // ---------- generation (simulated agents) ----------
  const CIVIC = /tax|measure|vote|council|bill|ordinance|law|board|mayor|city|permit|park|school|budget|fund|zoning|police|election|legislat|policy|rule|ban|develop/i;
  function topicOf(q) {
    let t = q.trim().replace(/[?.!]+$/, "");
    t = t.replace(/^(is it true that|is it true|did|does|do|is|are|was|were|will|why (did|does|is|are)|who|what|how|can|should)\s+/i, "");
    return t.length > 60 ? t.slice(0, 59) + "…" : t;
  }
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const otherPlatform = (p) => pick(PLATFORMS.filter((x) => x !== p));
  const fakeHandle = (p) => "@" + pick(["riverton", "local", "civic", "the", "real", "daily"]) + "." + pick(["watch", "tea", "files", "brief", "updates", "voices", "insider"]);

  async function generateBoard(b, q, seed) {
    ui.busy = true;
    const topic = topicOf(q);
    const civic = CIVIC.test(q + " " + (seed ? seed.title : ""));
    if (!b.question) b.question = q;
    if (b.title === "Untitled board" || /post$|investigation$/.test(b.title)) b.title = q.length > 48 ? q.slice(0, 47) + "…" : q;
    el.title.value = b.title;
    el.empty.hidden = true;

    // seed: the shared post / screenshot, or the question as a sticky note
    let C;
    if (seed) { C = { x: seed.x + (seed.w || 230) / 2, y: seed.y + 120 }; }
    else {
      C = { x: 1150, y: 600 };
      seed = { id: uid("n"), type: "note", color: "yellow", agent: "You", title: "THE QUESTION", body: q, x: C.x - 110, y: C.y - 90, w: 220, rot: -2, seed: true };
      b.nodes.push(seed);
      renderBoard(); el.nodes.querySelector(`[data-id="${seed.id}"]`).classList.add("drop");
      requestAnimationFrame(() => fitTo(new Set([seed.id]), 1.1));
    }
    const sp = seed.platform && PLATFORMS.includes(seed.platform) ? seed.platform : "TikTok";
    const claim = seed.type === "post" ? seed.title.replace(/^"|"$/g, "") : q;
    if (seed.type === "post" && !seed.checks) {
      seed.checks = {
        bias: { lean: 1, label: "Slanted framing", note: "Urgency and outrage cues, no link to a source. Creator's recent posts lean heavily one way on local issues." },
        validity: { verdict: "partial", note: "The underlying event is real, but the post overstates its scope. See the primary source pinned to the left." },
        origin: { chain: ["Earliest version: a local forum thread (6 days ago)", "Picked up by a " + otherPlatform(sp) + " account (4 days ago)", seed.handle + " · " + (seed.date || "this week")], note: "The original thread linked to the record. Each repost after that dropped the link and made the claim bigger." },
      };
    }

    await runTicker([
      `Reading ${seed.type === "post" ? seed.handle + "'s post" : seed.type === "shot" ? "your screenshot" : "your question"}…`,
      `Tracer: following reposts upstream across TikTok, Instagram & X`,
      civic ? `Evidence Checker: pulling the original legislation & public records` : `Evidence Checker: locating the original source`,
      civic ? `Tracer: following the money through campaign finance filings` : `Tracer: checking who runs the accounts involved`,
      `Bias Hound: scoring framing on every source`,
      `Pinning evidence and tying strings…`,
    ]);

    const at = (dx, dy, w) => ({ x: Math.round(C.x + dx - w / 2), y: Math.round(C.y + dy) });
    const N = {};
    const add = (key, n) => { n.id = uid("n"); n.rot = n.rot != null ? n.rot : +(Math.random() * 5 - 2.5).toFixed(1); Object.assign(n, at(n.dx, n.dy, n.w)); delete n.dx; delete n.dy; N[key] = n; return n; };
    const ok = (note) => ({ verdict: "verified", note });
    const neutral = (note) => ({ lean: 0, label: "Neutral", note });
    const recordOrigin = (src) => ({ chain: [src], note: "Primary source." });

    add("A", { type: "doc", stamp: "PRIMARY SOURCE", dx: -620, dy: -380, w: 260, platform: civic ? "Government record" : "Other",
      title: civic ? `Official record: ${cap(topic)}` : "Earliest traceable source",
      date: "Located by Evidence Checker",
      body: civic ? "Pulled from the city's public records. The actual provision is narrower than the posts say. It covers one program, not the whole city, and phases in over two years."
                  : "The core fact checks out. The framing around it got more dramatic with every repost, and the original included context that later versions dropped.",
      checks: { bias: neutral("Primary text, no persuasive language."), validity: ok("Matches the official archive."), origin: recordOrigin(civic ? "City Clerk public records (demo)" : "Original publication (demo)") } });
    add("B", civic
      ? { type: "doc", stamp: "AMENDED", dx: -640, dy: 170, w: 260, platform: "Government record", title: "Draft vs. final version", date: "Diff by Tracer",
          versions: [
            { v: "Draft", d: "Introduced", why: "Introduced by the sponsoring official.", clauses: [
              { k: "scope", t: "Applies citywide to all eligible programs." }, { k: "start", t: "Takes effect January 1, 2027." }, { k: "review", t: "Council reviews results after one year." } ] },
            { v: "Committee", d: "2 weeks later", why: "Committee substitute. The requester isn't disclosed.", clauses: [
              { k: "scope", t: "Applies to a pilot program in three districts." }, { k: "start", t: "Takes effect January 1, 2028." }, { k: "exempt", t: "Projects already under permit review are exempt." }, { k: "review", t: "Council reviews results after one year." } ] },
            { v: "Final", d: "Adopted", why: "Adopted without further changes.", clauses: [
              { k: "scope", t: "Applies to a pilot program in three districts." }, { k: "start", t: "Takes effect January 1, 2028." }, { k: "exempt", t: "Projects already under permit review are exempt." }, { k: "review", t: "Council reviews results after two years." } ] },
          ],
          body: "The first draft was broader. Committee narrowed the scope, pushed back the start date, and added one exemption clause late in the process.",
          checks: { bias: neutral("Legal text."), validity: ok("Both versions retrieved from the legislative archive."), origin: recordOrigin("Legislative archive v1 → v3 (demo)") } }
      : { type: "doc", stamp: "DATA", dx: -640, dy: 170, w: 250, platform: "Other", title: "What the data actually says", date: "Independent dataset",
          body: "The numbers show a real change, but a much smaller one than the viral version claims, roughly a tenth of the size.",
          checks: { bias: neutral("Raw data."), validity: ok("Dataset is public and reproducible."), origin: recordOrigin("Public dataset (demo)") } });
    add("C", { type: "note", color: "yellow", agent: "Tracer", dx: -990, dy: -40, w: 210,
      title: civic ? "WHAT CHANGED?" : "ORIGIN TRAIL",
      body: civic ? "draft → final:\nscope narrowed\nstart date pushed back\n1 exemption added in committee" : "first seen 6 days ago\n3 reposts, each one louder\noriginal had a link, later ones dropped it" });
    add("D", { type: "folder", dx: 420, dy: -400, w: 240, platform: civic ? "Government record" : "Other",
      title: civic ? "Funding & sponsors" : "Who's behind the accounts",
      files: civic
        ? [{ t: "Sponsoring official", d: "Introduced the item · voted YES" }, { t: "Top campaign donor", d: "Industry PAC · $40,000 (demo)" }, { t: "Lobbying disclosures", d: "3 meetings logged before the vote" }]
        : [{ t: "Account ownership", d: "Registered to a marketing agency (demo)" }, { t: "Sponsored-post tags", d: "2 of 4 viral posts carry paid tags" }, { t: "Affiliated groups", d: "Advocacy network, 1.2K members" }],
      checks: { bias: neutral("Disclosure records."), validity: ok("From public filings."), origin: recordOrigin(civic ? "County campaign finance portal (demo)" : "Platform transparency data (demo)") } });
    const pE = otherPlatform(sp), pF = otherPlatform(pE);
    add("E", { type: "post", platform: pE, handle: fakeHandle(pE), dx: 660, dy: -60, w: 225, date: "3 days ago", stats: pick(["48K views", "6.2K likes", "1.9K reposts"]),
      title: `"wait is this real?? ${shorten(claim.toLowerCase(), 70)} 😳 sharing just in case"`,
      checks: { bias: { lean: 1, label: "Slanted framing", note: "Repeats the claim with fear framing and adds nothing new." }, validity: { verdict: "contradicted", note: "Repeats the overstated version and cites no source." }, origin: { chain: [seed.handle ? seed.handle + " (original)" : "Earlier repost", "This account (repost)"], note: "Second-hand repost." } } });
    add("F", { type: "post", platform: pF, handle: fakeHandle(pF), dx: 600, dy: 380, w: 225, date: "2 days ago", stats: pick(["120K views", "14K likes", "3.3K reposts"]),
      title: `"I read the actual document so you don't have to. It's not what people are saying about ${shorten(topic.toLowerCase(), 50)}."`,
      checks: { bias: { lean: -1, label: "Mild slant the other way", note: "Accurate on the facts but dismissive. Leaves out the parts that are a real concern." }, validity: { verdict: "verified", note: "Quotes the primary source correctly." }, origin: { chain: ["Original post"], note: "Original author." } } });
    add("G", { type: "clip", platform: "News", outlet: pick(["The Riverton Ledger", "Riverton Public Radio", "Metro Weekly"]), dx: 40, dy: 500, w: 260, date: "This week",
      title: civic ? `What the ${cap(shorten(topic, 30))} decision actually does` : `Fact check: the viral claim about ${shorten(topic, 30)}`,
      body: "Local reporting confirms the main facts. The paper notes the scope is narrower than what's circulating online.",
      checks: { bias: { lean: 0, label: "Center", note: "Straight news write-up." }, validity: ok("Matches the primary source."), origin: recordOrigin("Original reporting") } });
    add("H", { type: "note", color: "green", agent: "Evidence Checker", dx: -300, dy: 360, w: 220,
      title: "PARTIALLY SUPPORTED", body: "The event is real. The scale is overstated. Primary record ≠ viral version." });
    add("I", { type: "note", color: "pink", agent: "Bias Hound", dx: 930, dy: 200, w: 210,
      title: "FRAMING", body: "4 of 5 social sources use fear language. The primary records don't." });
    add("J", { type: "note", color: "blue", agent: "Tracer", dx: -260, dy: -520, w: 220,
      title: "OPEN QUESTION", body: civic ? "Who requested the late exemption? Committee notes aren't public yet." : "Who started the first version? Original account has since been deleted." });

    const order = ["A", "C", "B", "J", "D", "E", "F", "G", "H", "I"];
    const strs = [
      ["S", "A", "connects", "claims to describe"], ["S", "H", "contradicts", "fact-checked by"], ["H", "A", "verified", "checked against"],
      ["A", "B", "changed", civic ? "amended into" : "measured by"], ["C", "B", "changed", civic ? "compares versions" : "traces"],
      ["D", "A", "money", civic ? "funded sponsor" : "paid partnership"], ["S", "E", "origin", "reposted as"], ["F", "S", "contradicts", "disputes"],
      ["G", "A", "verified", "reports on"], ["I", "E", "connects", "flags framing"], ["J", "D", "connects", "follow-up"], ["E", "D", "money", "paid to post? (claimed, not documented)", true], ["F", "A", "verified", "quotes"],
    ];
    const map = (k) => (k === "S" ? seed.id : N[k].id);
    let delay = 0;
    order.forEach((k) => { b.nodes.push(N[k]); el.nodes.appendChild(makeCard(N[k], true, delay)); delay += 140; });
    fitTo(null, 1.0);
    await sleep(delay + 200);
    const start = b.strings.length;
    strs.forEach(([f, t, kind, label, claimed]) => b.strings.push(claimed ? { from: map(f), to: map(t), kind, label, claimed: true } : { from: map(f), to: map(t), kind, label }));
    drawStrings(new Set(strs.map((_, i) => start + i)));

    const r = (k) => `[[${map(k)}]]`;
    b.summary = [
      { h: "The short version", p: `Partly true, but overstated. The claim ${r("S")} is based on something real, but the primary record ${r("A")} is much narrower than the viral version. Evidence Checker marks it partially supported ${r("H")}.` },
      { h: "Where it came from", p: `Tracer followed the story upstream ${r("C")}. The earliest version linked to a source, and each repost dropped more context. Another account picked it up within days ${r("E")}, and Bias Hound flagged fear framing across most of the social posts ${r("I")}.` },
      { h: civic ? "The original legislation & what changed" : "What the evidence says", p: civic ? `The official text ${r("A")} covers one program and phases in over two years. Comparing the draft with the final version ${r("B")} shows the scope was narrowed and an exemption was added late.` : `The data ${r("B")} shows a real effect, about a tenth the size of the viral claim.` },
      { h: civic ? "Who funded it" : "Who's behind it", p: civic ? `Public filings ${r("D")} list the sponsor's top donor and three lobbying meetings logged before the vote. That isn't proof of anything on its own, but it's on the board so you can follow it.` : `Ownership and sponsorship records ${r("D")} show some of the louder accounts carry paid tags.` },
      { h: "What can actually be verified", p: `A creator who read the source directly ${r("F")} and local reporting ${r("G")} both match the primary record.` },
      { h: "Still open", p: `${r("J")} Ask a follow-up below, or tap any pin and hit "Dig deeper".` },
    ];
    b.log = (b.log || []).concat([`Opened case: "${shorten(q, 60)}"`, "Tracer traced 3 reposts upstream", "Evidence Checker verified 4 sources against records", "Bias Hound flagged 2 slanted sources"]);
    save();
    hideTicker();
    ui.busy = false;
    renderSidebar(); renderDrawer();
    setTab("summary"); openSidebar();
    el.prompt.placeholder = "Ask Receipts a follow-up, or select a pin to dig into it…";
  }

  function intentOf(q) {
    q = (q || "").toLowerCase();
    if (/fund|paid|money|donor|behind|sponsor|conflict|lobby|request|who asked|who wanted|benefit/.test(q)) return "money";
    if (/chang|amend|differ|original|draft|left out/.test(q)) return "change";
    if (/true|real|verif|fact|accura|legit|biased/.test(q)) return "verify";
    if (/first|where|origin|start|who posted|came from/.test(q)) return "origin";
    if (/introduc|who wrote|sponsor/.test(q)) return "money";
    return "general";
  }

  async function digDeeper(node, q) {
    if (ui.busy) return toast("The agents are still working…");
    ui.busy = true;
    const b = board();
    q = q || `Dig deeper into ${shortTitle(node, 40)}`;
    const intent = intentOf(q);
    select(node.id, { open: false });
    focusNode(node.id);
    await runTicker([
      `Zooming in on ${shortTitle(node, 36)}`,
      { money: "Tracer: searching finance filings & disclosures", change: "Tracer: diffing earlier versions", verify: "Evidence Checker: cross-checking against primary records", origin: "Tracer: following the repost chain upstream", general: "Tracer & Evidence Checker: searching related sources" }[intent],
      "Bias Hound: scoring the new sources",
      "Growing a sub-board of strings…",
    ]);

    // place 4 new nodes in a fan pointing away from the board's center
    const all = b.nodes;
    const cx = all.reduce((a, n) => a + n.x, 0) / all.length, cy = all.reduce((a, n) => a + n.y, 0) / all.length;
    const nx = node.x + (node.w || 230) / 2, ny = node.y + 100;
    let base = Math.atan2(ny - cy, nx - cx);
    if (!isFinite(base) || (Math.abs(nx - cx) < 1 && Math.abs(ny - cy) < 1)) base = Math.PI / 2;
    const R = 400;
    const spots = [-1.05, -0.35, 0.35, 1.05].map((o) => ({ x: nx + Math.cos(base + o) * R, y: ny + Math.sin(base + o) * R * 0.85 }));
    // nudge each spot outward until it doesn't overlap an existing card
    const rects = b.nodes.map((m) => { const c = el.nodes.querySelector(`[data-id="${m.id}"]`); return { x: m.x, y: m.y, w: m.w || 230, h: c ? c.offsetHeight : 200 }; });
    const hits = (x, y, w, h) => rects.some((r) => x < r.x + r.w + 30 && x + w + 30 > r.x && y < r.y + r.h + 30 && y + h + 30 > r.y);
    const placed = [];
    const P = (i, w) => {
      if (placed[i]) return placed[i];
      const ang = Math.atan2(spots[i].y - ny, spots[i].x - nx);
      let x = spots[i].x - w / 2, y = spots[i].y - 90, step = 0;
      while (hits(x, y, w, 220) && step < 30) { x += Math.cos(ang) * 70; y += Math.sin(ang) * 70; step++; }
      const r = { x: Math.round(x), y: Math.round(y) };
      rects.push({ x: r.x, y: r.y, w, h: 220 });
      return (placed[i] = r);
    };
    const plat = otherPlatform(node.platform);
    const t = shortTitle(node, 40);
    const answers = {
      money: { title: "FOLLOW THE MONEY", body: "2 donors connect to this.\nLargest gift came 3 weeks before the key vote.\nNo disclosed conflict, but worth watching.", agent: "Tracer", color: "pink",
        doc: { stamp: "FILING", title: "Finance disclosure (demo)", body: "Contribution records and lobbying logs tied to this source. Amounts and dates are pinned in the folder." },
        a: (r) => `Tracer found two funding links ${r[0]}. The disclosure ${r[2]} lists the largest contribution about three weeks before the key vote. Related coverage ${r[3]} mentions the donor, and an earlier version ${r[1]} shows how the story was framed before the money was public.` },
      change: { title: "WHAT CHANGED", body: "earlier version was broader\nkey line removed in edit\nnew exemption added late", agent: "Tracer", color: "yellow",
        doc: { stamp: "ORIGINAL", title: "Earlier version (archived)", body: "Archived copy before edits. Compare the highlighted section: one sentence was removed and one exemption added." },
        a: (r) => `Comparing versions ${r[0]}: the archived original ${r[2]} was broader, and one line was removed in a later edit. An earlier repost ${r[1]} still quotes the original wording, and coverage ${r[3]} noticed the change.` },
      verify: { title: "VERIFIED?", body: "core fact: ✓ checks out\nthe numbers: ✗ inflated\nthe quote: ≈ out of context", agent: "Evidence Checker", color: "green",
        doc: { stamp: "PRIMARY SOURCE", title: "Primary record for this claim", body: "The official source behind this claim. The headline number is about 10× smaller in the original." },
        a: (r) => `Evidence Checker's breakdown ${r[0]}: the core fact holds up against the primary record ${r[2]}, but the numbers are inflated and one quote is out of context. An earlier version ${r[1]} had it right, and the coverage ${r[3]} agrees.` },
      origin: { title: "PATIENT ZERO", body: "first seen 6 days ago\non a local forum\n3 hops to this version", agent: "Tracer", color: "yellow",
        doc: { stamp: "ARCHIVE", title: "Earliest archived copy", body: "Web archive snapshot of the first known version, which links to the source this post leaves out." },
        a: (r) => `Tracer followed it back ${r[0]}: the earliest version ${r[2]} appeared on a local forum six days ago. It moved to ${plat} ${r[1]} and picked up more drama each time. ${r[3]} is the closest thing to original reporting.` },
      general: { title: "MORE CONTEXT", body: "3 more sources found\n1 confirms, 1 disputes\n1 adds missing context", agent: "Evidence Checker", color: "blue",
        doc: { stamp: "RECORD", title: "Related public record", body: "A record connected to this source that adds context the original leaves out." },
        a: (r) => `Agents found three more sources around this pin ${r[0]}. A related record ${r[2]} adds missing context, ${r[1]} repeats the original framing, and ${r[3]} disputes part of it.` },
    }[intent];

    const nn = [
      { type: "note", color: answers.color, agent: answers.agent, title: answers.title, body: answers.body, w: 210, ...P(0, 210) },
      { type: "post", platform: plat, handle: fakeHandle(plat), title: node.type === "post" || node.type === "shot" ? `"${intent === "origin" ? "original:" : "ok so"} ${shorten(t.toLowerCase().replace(/^@[\w.]+: /, ""), 60)}"` : `"has anyone actually read ${shorten(t.replace(/^@[\w.]+: /, ""), 40)}? because what I'm hearing doesn't match 🧵"`, date: "earlier", stats: pick(["9K views", "800 likes", "2.4K views"]), w: 220, ...P(1, 220),
        checks: { bias: { lean: 1, label: "Slanted", note: "Emotional framing, no link." }, validity: { verdict: "unverified", note: "Couldn't confirm independently." }, origin: { chain: ["Forum thread (earliest)", "This post"], note: "Earlier in the chain than the pin it came from." } } },
      { type: "doc", stamp: answers.doc.stamp, title: answers.doc.title, body: answers.doc.body, date: "Found by agents", platform: "Government record", w: 250, ...P(2, 250),
        checks: { bias: { lean: 0, label: "Neutral", note: "Record." }, validity: { verdict: "verified", note: "Public record." }, origin: { chain: ["Public archive (demo)"], note: "Primary source." } } },
      intent === "money"
        ? { type: "folder", title: "Donors & disclosures", files: [{ t: "Donor A (PAC)", d: "$40,000 · 3 wks before vote" }, { t: "Donor B (individual)", d: "$2,500" }, { t: "Lobbying log", d: "2 meetings" }], platform: "Government record", w: 240, ...P(3, 240),
            checks: { bias: { lean: 0, label: "Neutral", note: "Filings." }, validity: { verdict: "verified", note: "Public filings." }, origin: { chain: ["Campaign finance portal (demo)"], note: "Primary source." } } }
        : { type: "clip", outlet: pick(["Metro Weekly", "The Riverton Ledger", "Riverton Public Radio"]), platform: "News", title: `Follow-up: ${shorten(t.replace(/^@[\w.]+: /, ""), 40)}`, body: "Reporters followed up with officials. Some of the claim holds up, and some was never in the record.", date: "Today", w: 250, ...P(3, 250),
            checks: { bias: { lean: 0, label: "Center", note: "Straight reporting." }, validity: { verdict: "partial", note: "Partly confirmed." }, origin: { chain: ["Original reporting"], note: "1 hop." } } },
    ];
    nn.forEach((n) => { n.id = uid("n"); n.rot = +(Math.random() * 5 - 2.5).toFixed(1); n.parent = node.id; });
    const kinds = [
      [node.id, nn[0].id, intent === "verify" ? "verified" : intent === "money" ? "money" : "connects", "answers: " + shorten(q, 40)],
      [nn[1].id, node.id, "origin", "earlier version"],
      [node.id, nn[2].id, intent === "change" ? "changed" : intent === "money" ? "money" : "verified", intent === "change" ? "original text" : "backed by"],
      [nn[3].id, node.id, intent === "money" ? "money" : "connects", intent === "money" ? "funding" : "follows up"],
    ];
    let delay = 0;
    nn.forEach((n) => { b.nodes.push(n); el.nodes.appendChild(makeCard(n, true, delay)); delay += 150; });
    fitTo(new Set([node.id, ...nn.map((n) => n.id)]), 1.0);
    await sleep(delay + 250);
    const start = b.strings.length;
    kinds.forEach(([f, t2, kind, label]) => b.strings.push({ from: f, to: t2, kind, label }));
    drawStrings(new Set(kinds.map((_, i) => start + i)));
    applyFocus();

    const refs = nn.map((n) => `[[${n.id}]]`);
    b.qa = b.qa || [];
    b.qa.push({ q, a: answers.a(refs) });
    b.log = (b.log || []).concat([`Dug into ${shortTitle(node, 40)}: ${nn.length} new pins`]);
    save();
    hideTicker();
    ui.busy = false;
    renderDrawer();
    setTab("summary"); openSidebar();
    const sb = $("#tab-summary"); sb.scrollTop = sb.scrollHeight;
  }

  function removeNode(id) {
    const b = board();
    b.nodes = b.nodes.filter((n) => n.id !== id);
    b.strings = b.strings.filter((s) => s.from !== id && s.to !== id);
    ui.selected = null; save(); renderBoard();
    toast("Removed from board");
  }
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const shorten = (s, n) => (s.length > n ? s.slice(0, n - 1).trim() + "…" : s);

  el.title.addEventListener("input", () => { board().title = el.title.value; save(); renderDrawer(); });

  // ---------- analytics ----------
  $("#analyticsBtn").onclick = () => showView(ui.view === "analytics" ? "board" : "analytics");
  $("#discoverBtn").onclick = () => showView(ui.view === "discover" ? "board" : "discover");
  function showAnalytics(on) { showView(on ? "analytics" : "board"); }
  function showView(v) {
    ui.view = v;
    const on = v !== "board";
    el.analytics.hidden = !on; el.boardWrap.hidden = on;
    $("#analyticsBtn").classList.toggle("active", v === "analytics");
    $("#discoverBtn").classList.toggle("active", v === "discover");
    el.sidebar.style.display = on ? "none" : "";
    el.analytics.scrollTop = 0;
    if (v === "analytics") renderAnalytics();
    if (v === "discover") renderDiscover();
  }
  let discoverCat = "All";
  function renderDiscover() {
    const cats = ["All"].concat(PT_DATA.categories);
    const items = PT_DATA.discover.map((d) => {
      if (d.board) { const b = S.boards.find((x) => x.id === d.board); return b ? { title: b.title, category: b.category, location: b.location, blurb: (b.summary && b.summary[0] ? b.summary[0].p.replace(/\[\[[\w-]+\]\]/g, "").slice(0, 150) + "…" : ""), board: b.id, n: b.nodes.length } : null; }
      return d;
    }).filter(Boolean).filter((d) => discoverCat === "All" || d.category === discoverCat);
    el.analytics.innerHTML = `<div class="an-wrap">
      <div class="an-head"><h1>Discover investigations</h1><p>Every headline has a paper trail. Pick a story and follow it. Receipts sticks to stories where the evidence, relationships, and decision-making actually add something.</p></div>
      <div class="cat-row">${cats.map((c) => `<button class="chip ${c === discoverCat ? "on" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("")}</div>
      <div class="disc-grid">${items.map((d, i) => `<button class="disc-card" data-i="${i}">
        <span class="disc-meta"><span class="cat-chip">${esc(d.category)}</span><span>${esc(d.location || "")}</span></span>
        <span class="disc-title">${esc(d.title)}</span>
        <span class="disc-blurb">${esc(d.blurb || "")}</span>
        <span class="disc-foot">${d.board ? `📌 ${d.n} pins · open Story File` : "🧵 Start this investigation"}</span>
      </button>`).join("") || `<p class="muted">Nothing in this category yet.</p>`}</div>
      <p class="muted" style="margin-top:18px;font-size:12px">Illustrative product concept. Riverton and everyone in it are fictional.</p>
    </div>`;
    el.analytics.querySelectorAll("[data-cat]").forEach((x) => (x.onclick = () => { discoverCat = x.dataset.cat; renderDiscover(); }));
    el.analytics.querySelectorAll(".disc-card").forEach((x) => (x.onclick = () => {
      const d = items[+x.dataset.i];
      if (d.board) return switchBoard(d.board);
      const b = newBoard();
      b.category = d.category; b.location = d.location; b.question = d.title; b.title = d.title;
      generateBoard(b, d.title, null);
    }));
  }
  function category(n) {
    if (n.type === "shot") return "Your screenshots";
    if (n.type === "post") return n.platform;
    if (n.type === "clip") return "News outlets";
    if (n.type === "doc" || n.type === "folder") return n.platform === "Government record" ? "Public records" : "Other sources";
    return null;
  }
  function renderAnalytics() {
    const srcs = [];
    S.boards.forEach((b) => b.nodes.forEach((n) => { const c = category(n); if (c) srcs.push({ n, c, b }); }));
    const order = ["TikTok", "Instagram", "X", "News outlets", "Public records", "Your screenshots", "Other sources"];
    const counts = order.map((c) => ({ c, v: srcs.filter((s) => s.c === c).length }));
    const total = srcs.length || 1;
    const max = Math.max(1, ...counts.map((x) => x.v));
    const social = srcs.filter((s) => PLATFORMS.includes(s.c)).length;
    const seeds = []; S.boards.forEach((b) => b.nodes.forEach((n) => { if (n.seed) seeds.push(category(n) || "Typed question"); }));
    S.boards.forEach((b) => { if (b.nodes.length && !b.nodes.some((n) => n.seed)) seeds.push("Typed question"); });
    const seedTop = topCount(seeds);
    const vs = ["verified", "partial", "unverified", "contradicted"];
    const vcount = vs.map((v) => ({ v, n: srcs.filter((s) => s.n.checks && s.n.checks.validity && s.n.checks.validity.verdict === v).length }));
    const vtotal = vcount.reduce((a, c) => a + c.n, 0) || 1;
    const lean = [-2, -1, 0, 1, 2].map((l) => srcs.filter((s) => s.n.checks && s.n.checks.bias && s.n.checks.bias.lean === l).length);
    const lmax = Math.max(1, ...lean);
    const leanCol = ["#1c5cab", "#6da7ec", "#8a897f", "#ec8a8a", "#d03b3b"];
    const socialVerified = srcs.filter((s) => PLATFORMS.includes(s.c) && s.n.checks && s.n.checks.validity);
    const sv = socialVerified.filter((s) => s.n.checks.validity.verdict === "verified").length;
    const recordsV = srcs.filter((s) => s.c === "Public records").length;

    el.analytics.innerHTML = `<div class="an-wrap">
      <div class="an-head"><h1>Where you get your information</h1><p>Across all ${S.boards.length} of your boards. Updates as you pin new sources.</p></div>
      <div class="tiles">
        <div class="tile"><div class="lbl">Sources pinned</div><div class="val">${srcs.length}</div><div class="sub">across ${S.boards.length} boards</div></div>
        <div class="tile"><div class="lbl">From social media</div><div class="val">${Math.round((social / total) * 100)}%</div><div class="sub">TikTok, Instagram & X</div></div>
        <div class="tile"><div class="lbl">Verified overall</div><div class="val">${Math.round((vcount[0].n / vtotal) * 100)}%</div><div class="sub">of agent-checked sources</div></div>
        <div class="tile"><div class="lbl">Your questions start on</div><div class="val" style="font-size:24px;padding-top:6px">${esc(seedTop.k || "–")}</div><div class="sub">${seedTop.n} of ${seeds.length} boards</div></div>
      </div>
      <div class="panels">
        <div class="panel" id="pPlat">
          <button class="tbl-toggle" data-tbl="pPlat">Table</button>
          <h2>Sources by where they came from</h2><p class="desc">Count of pinned sources by origin</p>
          <div class="chart">${counts.map((x) => `<div class="hbar" data-tip="${esc(x.c)}: ${x.v} sources (${Math.round((x.v / total) * 100)}%)"><span class="name">${esc(x.c)}</span><span class="track"><span class="fill" style="display:block;width:${(x.v / max) * 100}%"></span></span><span class="num">${x.v}</span></div>`).join("")}</div>
          <table class="dt" hidden><tr><th>Origin</th><th>Sources</th></tr>${counts.map((x) => `<tr><td>${esc(x.c)}</td><td>${x.v}</td></tr>`).join("")}</table>
        </div>
        <div class="panel" id="pVer">
          <button class="tbl-toggle" data-tbl="pVer">Table</button>
          <h2>How your sources hold up</h2><p class="desc">Evidence Checker verdicts</p>
          <div class="chart"><div class="stack">${vcount.filter((x) => x.n).map((x) => `<div data-tip="${VERDICT[x.v].label}: ${x.n} (${Math.round((x.n / vtotal) * 100)}%)" style="flex:${x.n};background:var(--${statusVar(x.v)})"></div>`).join("")}</div>
          <div class="stack-legend">${vcount.map((x) => `<div class="r"><span class="sw" style="background:var(--${statusVar(x.v)})"></span>${VERDICT[x.v].icon} ${VERDICT[x.v].label}<b>${x.n}</b></div>`).join("")}</div></div>
          <table class="dt" hidden><tr><th>Verdict</th><th>Sources</th></tr>${vcount.map((x) => `<tr><td>${VERDICT[x.v].label}</td><td>${x.n}</td></tr>`).join("")}</table>
        </div>
        <div class="panel" id="pLean">
          <button class="tbl-toggle" data-tbl="pLean">Table</button>
          <h2>Framing slant</h2><p class="desc">Bias Hound's read on each source, for or against its topic</p>
          <div class="chart"><div class="diverge">${lean.map((v, i) => `<div class="col" data-tip="${["Strongly for", "Leans for", "Neutral", "Leans against", "Strongly against"][i]}: ${v}"><span class="n">${v}</span><span class="bar" style="height:${(v / lmax) * 80}%;background:${leanCol[i]}"></span></div>`).join("")}</div>
          <div class="diverge-labels"><span>Strongly for</span><span>Leans for</span><span>Neutral</span><span>Leans against</span><span>Strongly against</span></div></div>
          <table class="dt" hidden><tr><th>Slant</th><th>Sources</th></tr>${lean.map((v, i) => `<tr><td>${["Strongly for", "Leans for", "Neutral", "Leans against", "Strongly against"][i]}</td><td>${v}</td></tr>`).join("")}</table>
        </div>
        <div class="panel">
          <h2>Boards</h2><p class="desc">Sources per board</p>
          ${S.boards.map((b) => { const n = b.nodes.filter((x) => category(x)).length; return `<button class="board-item" data-b="${b.id}"><span class="thumb"></span><span><div class="t">${esc(b.title)}</div><div class="m">${n} sources · ${b.strings.length} strings</div></span></button>`; }).join("")}
        </div>
      </div>
      <div class="insight"><span class="ic">🕵️</span><div><b>Detective's note:</b> ${social ? `${Math.round((social / total) * 100)}% of what you pin comes from social feeds, and only ${socialVerified.length ? Math.round((sv / socialVerified.length) * 100) : 0}% of those posts held up on their own.` : "You haven't pinned social posts yet."} ${recordsV ? `The answers usually came from public records (${recordsV} pinned). Going to the record first is the fastest way to the truth.` : ""}</div></div>
    </div>`;
    el.analytics.querySelectorAll("[data-b]").forEach((x) => (x.onclick = () => switchBoard(x.dataset.b)));
    el.analytics.querySelectorAll("[data-tbl]").forEach((btn) => (btn.onclick = () => {
      const p = $("#" + btn.dataset.tbl), t = p.querySelector("table"), c = p.querySelector(".chart");
      const showT = t.hidden; t.hidden = !showT; c.hidden = showT; btn.textContent = showT ? "Chart" : "Table";
    }));
  }
  function topCount(arr) {
    const m = {}; arr.forEach((x) => (m[x] = (m[x] || 0) + 1));
    let k = null, n = 0; Object.entries(m).forEach(([a, c]) => { if (c > n) { k = a; n = c; } });
    return { k, n };
  }
  // chart hover tooltip
  const tip = document.createElement("div"); tip.className = "tip"; tip.hidden = true; document.body.appendChild(tip);
  el.analytics.addEventListener("mousemove", (e) => {
    const t = e.target.closest("[data-tip]");
    if (!t) { tip.hidden = true; return; }
    tip.textContent = t.dataset.tip; tip.hidden = false;
    tip.style.left = Math.min(e.clientX + 14, window.innerWidth - 220) + "px"; tip.style.top = e.clientY + 14 + "px";
  });
  el.analytics.addEventListener("mouseleave", () => (tip.hidden = true));

  // ---------- boot ----------
  if (window.innerWidth < 1000) el.sidebar.classList.add("closed");
  renderLegend();
  renderBoard();
  applyCam();
  const boot = () => fitTo(null, 1.1, false);
  requestAnimationFrame(boot);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(boot);
  window.addEventListener("resize", () => { if (ui.view === "board") fitTo(null, 1.1, false); });
})();
