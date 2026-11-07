export const uid = (p) => p + Math.random().toString(36).slice(2, 8);
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const shorten = (s, n) => (s.length > n ? s.slice(0, n - 1).trim() + "…" : s);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function shortTitle(n, len = 46) {
  const t = (n.type === "post" ? n.handle + ": " : "") + String(n.title || "").replace(/^"|"$/g, "");
  return t.length > len ? t.slice(0, len - 1) + "…" : t;
}

export function neighbors(board, id) {
  const set = new Set([id]);
  board.strings.forEach((s) => {
    if (s.from === id) set.add(s.to);
    if (s.to === id) set.add(s.from);
  });
  return set;
}

/** Word-level LCS diff → [{t, op: "same"|"del"|"ins"}] with adjacent ops merged. */
export function wordDiff(a, b) {
  const A = a.split(" "), B = b.split(" ");
  const m = A.length, n = B.length;
  const L = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = [];
  const push = (t, op) => {
    const last = out[out.length - 1];
    if (last && last.op === op) last.t += " " + t;
    else out.push({ t, op });
  };
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (A[i] === B[j]) { push(A[i], "same"); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) push(A[i++], "del");
    else push(B[j++], "ins");
  }
  while (i < m) push(A[i++], "del");
  while (j < n) push(B[j++], "ins");
  return out;
}

export function pinPoint(n) {
  return { x: n.x + (n.w || 230) / 2, y: n.y + 2 };
}

export function stringPath(a, b) {
  const p1 = pinPoint(a), p2 = pinPoint(b);
  const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const sag = Math.min(140, 30 + dist * 0.12);
  const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2 + sag;
  return `M${p1.x},${p1.y} Q${mx},${my} ${p2.x},${p2.y}`;
}
