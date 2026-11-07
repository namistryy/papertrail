import PT_DATA from "../data.js";
import { STORE_KEY } from "./constants.js";

const clone = (o) => JSON.parse(JSON.stringify(o));

export function freshState() {
  const boards = clone(PT_DATA.boards);
  boards.forEach((b) => {
    b.qa = b.qa || [];
    b.log = b.log || [
      `Tracer followed ${b.nodes.filter((n) => n.type === "post").length} social posts upstream`,
      `Evidence Checker checked ${b.nodes.filter((n) => n.checks).length} sources against primary records`,
      "Bias Hound scored framing on every source",
    ];
  });
  return { boards, inbox: clone(PT_DATA.inbox), activeId: boards[0].id };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.boards && s.boards.length) return s;
    }
  } catch (e) { /* storage unavailable */ }
  return freshState();
}

export function saveState(s) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); return true; }
  catch (e) { return false; }
}
