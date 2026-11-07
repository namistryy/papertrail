/* Simulated detective agents. Pure functions: given a board + question they
   return new pins, strings and Story File text. Swap these for real model
   calls later; the UI only depends on the returned shapes. */
import { PLATFORMS } from "./constants.js";
import { uid, pick, cap, shorten, shortTitle } from "./util.js";

const CIVIC = /tax|measure|vote|council|bill|ordinance|law|board|mayor|city|permit|park|school|budget|fund|zoning|police|election|legislat|policy|rule|ban|develop|contract|prop/i;

export function topicOf(q) {
  let t = q.trim().replace(/[?.!]+$/, "");
  t = t.replace(/^(is it true that|is it true|did|does|do|is|are|was|were|will|why (did|does|is|are)|who|what|how|can|should)\s+/i, "");
  return t.length > 60 ? t.slice(0, 59) + "…" : t;
}
export const isCivic = (text) => CIVIC.test(text);
const otherPlatform = (p) => pick(PLATFORMS.filter((x) => x !== p));
const fakeHandle = () => "@" + pick(["riverton", "local", "civic", "the", "real", "daily"]) + "." + pick(["watch", "tea", "files", "brief", "updates", "voices", "insider"]);
const rot = () => +(Math.random() * 5 - 2.5).toFixed(1);

export function questionNote(q, C) {
  return { id: uid("n"), type: "note", color: "yellow", agent: "You", title: "THE QUESTION", body: q, x: C.x - 110, y: C.y - 90, w: 220, rot: -2, seed: true };
}

export function postNode(p, x, y) {
  return { id: uid("n"), type: "post", platform: p.platform, handle: p.handle, title: p.title, date: p.date, stats: p.stats, x, y, w: 230, rot: +(Math.random() * 4 - 2).toFixed(1), seed: true };
}

export function shotNode(att, x, y) {
  return {
    id: uid("n"), type: "shot", img: att.img, platform: "Upload", title: "Your screenshot: " + att.name, date: "today", stats: "", x, y, w: 240, rot: 1.5, seed: true,
    checks: {
      bias: { lean: 1, label: "Mild slant", note: "Text pulled from the image (simulated OCR) uses urgency cues like \"BREAKING\", \"nobody's talking about it\"." },
      validity: { verdict: "unverified", note: "The screenshot has no link. Agents matched its text to 3 public posts but couldn't confirm the original." },
      context: "Screenshots strip the link, the date, and any replies or corrections under the original post.",
      origin: { chain: ["Screenshot uploaded by you · today", "Closest text match: a TikTok repost (simulated)", "Earliest match: an X post 6 days earlier (simulated)"], note: "Screenshots strip the original link, so Tracer reconstructs the chain by matching text." },
    },
  };
}

export function generateSteps(seed, q) {
  const civic = isCivic(q + " " + (seed ? seed.title : ""));
  return [
    `Reading ${seed && seed.type === "post" ? seed.handle + "'s post" : seed && seed.type === "shot" ? "your screenshot" : "your question"}…`,
    "Tracer: following reposts upstream across TikTok, Instagram & X",
    civic ? "Evidence Checker: pulling the original legislation & public records" : "Evidence Checker: locating the original source",
    civic ? "Tracer: following the money through campaign finance filings" : "Tracer: checking who runs the accounts involved",
    "Bias Hound: scoring framing on every source",
    "Pinning evidence and tying strings…",
  ];
}

/** Opens a new investigation around `seed`. Returns { nodes, strings, summary, log, seedChecks }. */
export function generateBoard(q, seed) {
  const topic = topicOf(q);
  const civic = isCivic(q + " " + (seed ? seed.title : ""));
  const C = { x: seed.x + (seed.w || 230) / 2, y: seed.y + 120 };
  const sp = seed.platform && PLATFORMS.includes(seed.platform) ? seed.platform : "TikTok";
  const claim = seed.type === "post" ? seed.title.replace(/^"|"$/g, "") : q;

  let seedChecks = null;
  if (seed.type === "post" && !seed.checks) {
    seedChecks = {
      bias: { lean: 1, label: "Slanted framing", note: "Urgency and outrage cues, no link to a source. Creator's recent posts lean heavily one way on local issues." },
      validity: { verdict: "partial", note: "The underlying event is real, but the post overstates its scope. See the primary source pinned to the left." },
      context: "Leaves out the scope and timeline in the primary record, and doesn't link to any source.",
      origin: { chain: ["Earliest version: a local forum thread (6 days ago)", "Picked up by a " + otherPlatform(sp) + " account (4 days ago)", seed.handle + " · " + (seed.date || "this week")], note: "The original thread linked to the record. Each repost after that dropped the link and made the claim bigger." },
    };
  }

  const N = {};
  const add = (key, n) => {
    n.id = uid("n");
    n.rot = n.rot != null ? n.rot : rot();
    n.x = Math.round(C.x + n.dx - n.w / 2);
    n.y = Math.round(C.y + n.dy);
    delete n.dx; delete n.dy;
    N[key] = n;
  };
  const ok = (note) => ({ verdict: "verified", note });
  const neutral = (note) => ({ lean: 0, label: "Neutral", note });
  const recordOrigin = (src) => ({ chain: [src], note: "Primary source." });

  add("A", { type: "doc", stamp: "PRIMARY SOURCE", dx: -620, dy: -380, w: 260, platform: civic ? "Government record" : "Other",
    title: civic ? `Official record: ${cap(topic)}` : "Earliest traceable source", date: "Located by Evidence Checker",
    body: civic ? "Pulled from the city's public records. The actual provision is narrower than the posts say. It covers one program, not the whole city, and phases in over two years."
                : "The core fact checks out. The framing around it got more dramatic with every repost, and the original included context that later versions dropped.",
    checks: { bias: neutral("Primary text, no persuasive language."), validity: ok("Matches the official archive."), origin: recordOrigin(civic ? "City Clerk public records (demo)" : "Original publication (demo)") } });
  add("B", civic
    ? { type: "doc", stamp: "AMENDED", dx: -640, dy: 170, w: 260, platform: "Government record", title: "Draft vs. final version", date: "Diff by Tracer",
        versions: [
          { v: "Draft", d: "Introduced", why: "Introduced by the sponsoring official.", clauses: [
            { k: "scope", t: "Applies citywide to all eligible programs." }, { k: "start", t: "Takes effect January 1, 2027." }, { k: "review", t: "Council reviews results after one year." }] },
          { v: "Committee", d: "2 weeks later", why: "Committee substitute. The requester isn't disclosed.", clauses: [
            { k: "scope", t: "Applies to a pilot program in three districts." }, { k: "start", t: "Takes effect January 1, 2028." }, { k: "exempt", t: "Projects already under permit review are exempt." }, { k: "review", t: "Council reviews results after one year." }] },
          { v: "Final", d: "Adopted", why: "Adopted without further changes.", clauses: [
            { k: "scope", t: "Applies to a pilot program in three districts." }, { k: "start", t: "Takes effect January 1, 2028." }, { k: "exempt", t: "Projects already under permit review are exempt." }, { k: "review", t: "Council reviews results after two years." }] },
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
  add("E", { type: "post", platform: pE, handle: fakeHandle(), dx: 660, dy: -60, w: 225, date: "3 days ago", stats: pick(["48K views", "6.2K likes", "1.9K reposts"]),
    title: `"wait is this real?? ${shorten(claim.toLowerCase(), 70)} 😳 sharing just in case"`,
    checks: { bias: { lean: 1, label: "Slanted framing", note: "Repeats the claim with fear framing and adds nothing new." }, validity: { verdict: "contradicted", note: "Repeats the overstated version and cites no source." }, context: "No source, and no mention of the scope or timeline in the record.", origin: { chain: [seed.handle ? seed.handle + " (original)" : "Earlier repost", "This account (repost)"], note: "Second-hand repost." } } });
  add("F", { type: "post", platform: pF, handle: fakeHandle(), dx: 600, dy: 380, w: 225, date: "2 days ago", stats: pick(["120K views", "14K likes", "3.3K reposts"]),
    title: `"I read the actual document so you don't have to. It's not what people are saying about ${shorten(topic.toLowerCase(), 50)}."`,
    checks: { bias: { lean: -1, label: "Mild slant the other way", note: "Accurate on the facts but dismissive. Leaves out the parts that are a real concern." }, validity: { verdict: "verified", note: "Quotes the primary source correctly." }, context: "Skips the late exemption and the open questions about who asked for it.", origin: { chain: ["Original post"], note: "Original author." } } });
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
  const id = (k) => (k === "S" ? seed.id : N[k].id);
  const S = (f, t, kind, label, extra) => ({ from: id(f), to: id(t), kind, label, ...(extra || {}) });
  const strings = [
    S("S", "A", "connects", "claims to describe"), S("S", "H", "contradicts", "evidence-checked by"), S("H", "A", "verified", "checked against"),
    S("A", "B", "changed", civic ? "amended into" : "measured by"), S("C", "B", "changed", civic ? "compares versions" : "traces"),
    S("D", "A", "money", civic ? "disclosed contribution to sponsor" : "paid partnership"), S("S", "E", "origin", "reposted as"), S("F", "S", "contradicts", "disputes"),
    S("G", "A", "verified", "reports on"), S("I", "E", "connects", "flags framing"), S("J", "D", "connects", "follow-up"),
    S("E", "D", "money", "paid to post? (claimed, not documented)", { claimed: true, ev: "Bias Hound noticed the same wording across sponsored accounts, but no disclosure ties this post to a payment. It's a claim, not a documented link." }),
    S("F", "A", "verified", "quotes"),
  ];
  const r = (k) => `[[${id(k)}]]`;
  const summary = [
    { h: "The short version", p: `Partly true, but overstated. The claim ${r("S")} is based on something real, but the primary record ${r("A")} is much narrower than the viral version. Evidence Checker marks it partially supported ${r("H")}.` },
    { h: "Where it came from", p: `Tracer followed the story upstream ${r("C")}. The earliest version linked to a source, and each repost dropped more context. Another account picked it up within days ${r("E")}, and Bias Hound flagged fear framing across most of the social posts ${r("I")}.` },
    { h: civic ? "The original legislation & what changed" : "What the evidence says", p: civic ? `The official text ${r("A")} covers one program and phases in over two years. Comparing the draft with the final version ${r("B")} shows the scope was narrowed and an exemption was added late. Open its Paper Trail to see the exact wording.` : `The data ${r("B")} shows a real effect, about a tenth the size of the viral claim.` },
    { h: civic ? "Who funded it" : "Who's behind it", p: civic ? `Public filings ${r("D")} list the sponsor's top donor and three lobbying meetings logged before the vote. That's documented, but it isn't proof the money influenced the decision.` : `Ownership and sponsorship records ${r("D")} show some of the louder accounts carry paid tags.` },
    { h: "What can actually be verified", p: `A creator who read the source directly ${r("F")} and local reporting ${r("G")} both match the primary record.` },
    { h: "Still open", p: `${r("J")} Ask a follow-up below, or tap any pin and hit "Dig deeper".` },
  ];
  const log = [`Opened case: "${shorten(q, 60)}"`, "Tracer traced 3 reposts upstream", "Evidence Checker verified 4 sources against records", "Bias Hound flagged 2 slanted sources"];
  return { nodes: order.map((k) => N[k]), strings, summary, log, seedChecks };
}

export function intentOf(q) {
  q = (q || "").toLowerCase();
  if (/fund|paid|money|donor|behind|sponsor|conflict|lobby|request|who asked|who wanted|benefit|introduc|who wrote/.test(q)) return "money";
  if (/chang|amend|differ|original|draft|left out/.test(q)) return "change";
  if (/true|real|verif|fact|accura|legit|biased/.test(q)) return "verify";
  if (/first|where|origin|start|who posted|came from/.test(q)) return "origin";
  return "general";
}

export function digSteps(node, q) {
  const intent = intentOf(q);
  return [
    `Zooming in on ${shortTitle(node, 36)}`,
    { money: "Tracer: searching finance filings & disclosures", change: "Tracer: diffing earlier versions", verify: "Evidence Checker: cross-checking against primary records", origin: "Tracer: following the repost chain upstream", general: "Tracer & Evidence Checker: searching related sources" }[intent],
    "Bias Hound: scoring the new sources",
    "Growing a sub-board of strings…",
  ];
}

/** Grows a sub-network around `node`. heightOf(id) gives rendered card heights for collision checks. */
export function digDeeper(board, node, q, heightOf) {
  const intent = intentOf(q);
  const all = board.nodes;
  const cx = all.reduce((a, n) => a + n.x, 0) / all.length, cy = all.reduce((a, n) => a + n.y, 0) / all.length;
  const nx = node.x + (node.w || 230) / 2, ny = node.y + 100;
  let base = Math.atan2(ny - cy, nx - cx);
  if (!isFinite(base) || (Math.abs(nx - cx) < 1 && Math.abs(ny - cy) < 1)) base = Math.PI / 2;
  const R = 400;
  const spots = [-1.05, -0.35, 0.35, 1.05].map((o) => ({ x: nx + Math.cos(base + o) * R, y: ny + Math.sin(base + o) * R * 0.85 }));
  const rects = all.map((m) => ({ x: m.x, y: m.y, w: m.w || 230, h: heightOf(m.id) || 200 }));
  const hits = (x, y, w, h) => rects.some((r) => x < r.x + r.w + 30 && x + w + 30 > r.x && y < r.y + r.h + 30 && y + h + 30 > r.y);
  const P = (i, w) => {
    const ang = Math.atan2(spots[i].y - ny, spots[i].x - nx);
    let x = spots[i].x - w / 2, y = spots[i].y - 90, step = 0;
    while (hits(x, y, w, 220) && step < 30) { x += Math.cos(ang) * 70; y += Math.sin(ang) * 70; step++; }
    const r = { x: Math.round(x), y: Math.round(y) };
    rects.push({ ...r, w, h: 220 });
    return r;
  };
  const plat = otherPlatform(node.platform);
  const t = shortTitle(node, 40).replace(/^@[\w.]+: /, "");
  const A = {
    money: { title: "FOLLOW THE MONEY", body: "2 donors connect to this.\nLargest gift came 3 weeks before the key vote.\nTiming is documented; influence is not.", agent: "Tracer", color: "pink",
      doc: { stamp: "FILING", title: "Finance disclosure (demo)", body: "Contribution records and lobbying logs tied to this source. Amounts and dates are pinned in the folder." },
      a: (r) => `Tracer found two funding links ${r[0]}. The disclosure ${r[2]} lists the largest contribution about three weeks before the key vote. The timing is documented, but whether it influenced the decision isn't. The donor folder ${r[3]} has the amounts, and an earlier post ${r[1]} shows how the story was framed before the money was public.` },
    change: { title: "WHAT CHANGED", body: "earlier version was broader\nkey line removed in edit\nnew exemption added late", agent: "Tracer", color: "yellow",
      doc: { stamp: "ORIGINAL", title: "Earlier version (archived)", body: "Archived copy before edits. Compare the highlighted section: one sentence was removed and one exemption added." },
      a: (r) => `Comparing versions ${r[0]}: the archived original ${r[2]} was broader, and one line was removed in a later edit. An earlier repost ${r[1]} still quotes the original wording, and coverage ${r[3]} noticed the change.` },
    verify: { title: "WHAT HOLDS UP?", body: "core fact: ✓ documented\nthe numbers: ✗ inflated\nthe quote: ≈ out of context", agent: "Evidence Checker", color: "green",
      doc: { stamp: "PRIMARY SOURCE", title: "Primary record for this claim", body: "The official source behind this claim. The headline number is about 10× smaller in the original." },
      a: (r) => `Evidence Checker's breakdown ${r[0]}: the core fact is documented in the primary record ${r[2]}, but the numbers are inflated and one quote is out of context. An earlier version ${r[1]} had it right, and the coverage ${r[3]} agrees.` },
    origin: { title: "PATIENT ZERO", body: "first seen 6 days ago\non a local forum\n3 hops to this version", agent: "Tracer", color: "yellow",
      doc: { stamp: "ARCHIVE", title: "Earliest archived copy", body: "Web archive snapshot of the first known version, which links to the source this post leaves out." },
      a: (r) => `Tracer followed it back ${r[0]}: the earliest version ${r[2]} appeared on a local forum six days ago. It moved to ${plat} ${r[1]} and picked up more drama each time. ${r[3]} is the closest thing to original reporting.` },
    general: { title: "MORE CONTEXT", body: "3 more sources found\n1 confirms, 1 disputes\n1 adds missing context", agent: "Evidence Checker", color: "blue",
      doc: { stamp: "RECORD", title: "Related public record", body: "A record connected to this source that adds context the original leaves out." },
      a: (r) => `Agents found three more sources around this pin ${r[0]}. A related record ${r[2]} adds missing context, ${r[1]} repeats the original framing, and ${r[3]} disputes part of it.` },
  }[intent];

  const nn = [
    { type: "note", color: A.color, agent: A.agent, title: A.title, body: A.body, w: 210, ...P(0, 210) },
    { type: "post", platform: plat, handle: fakeHandle(), w: 220, ...P(1, 220), date: "earlier", stats: pick(["9K views", "800 likes", "2.4K views"]),
      title: node.type === "post" || node.type === "shot"
        ? `"${intent === "origin" ? "original:" : "ok so"} ${shorten(t.toLowerCase(), 60)}"`
        : `"has anyone actually read ${shorten(t, 40)}? because what I'm hearing doesn't match 🧵"`,
      checks: { bias: { lean: 1, label: "Slanted", note: "Emotional framing, no link." }, validity: { verdict: "unverified", note: "Couldn't confirm independently." }, context: "No source linked.", origin: { chain: ["Forum thread (earliest)", "This post"], note: "Earlier in the chain than the pin it came from." } } },
    { type: "doc", stamp: A.doc.stamp, title: A.doc.title, body: A.doc.body, date: "Found by agents", platform: "Government record", w: 250, ...P(2, 250),
      checks: { bias: { lean: 0, label: "Neutral", note: "Record." }, validity: { verdict: "verified", note: "Public record." }, origin: { chain: ["Public archive (demo)"], note: "Primary source." } } },
    intent === "money"
      ? { type: "folder", title: "Donors & disclosures", files: [{ t: "Donor A (PAC)", d: "$40,000 · 3 wks before vote" }, { t: "Donor B (individual)", d: "$2,500" }, { t: "Lobbying log", d: "2 meetings" }], platform: "Government record", w: 240, ...P(3, 240),
          checks: { bias: { lean: 0, label: "Neutral", note: "Filings." }, validity: { verdict: "verified", note: "Public filings." }, origin: { chain: ["Campaign finance portal (demo)"], note: "Primary source." } } }
      : { type: "clip", outlet: pick(["Metro Weekly", "The Riverton Ledger", "Riverton Public Radio"]), platform: "News", title: `Follow-up: ${shorten(t, 40)}`, body: "Reporters followed up with officials. Some of the claim holds up, and some was never in the record.", date: "Today", w: 250, ...P(3, 250),
          checks: { bias: { lean: 0, label: "Center", note: "Straight reporting." }, validity: { verdict: "partial", note: "Partly confirmed." }, origin: { chain: ["Original reporting"], note: "1 hop." } } },
  ];
  nn.forEach((n) => { n.id = uid("n"); n.rot = rot(); n.parent = node.id; });
  const strings = [
    { from: node.id, to: nn[0].id, kind: intent === "verify" ? "verified" : intent === "money" ? "money" : "connects", label: "answers: " + shorten(q, 40) },
    { from: nn[1].id, to: node.id, kind: "origin", label: "earlier version" },
    { from: node.id, to: nn[2].id, kind: intent === "change" ? "changed" : intent === "money" ? "money" : "verified", label: intent === "change" ? "original text" : "backed by" },
    intent === "money"
      ? { from: nn[3].id, to: node.id, kind: "money", label: "influenced the decision? (claimed, not documented)", claimed: true, ev: "Documented: contribution dates and amounts. NOT documented: any link between the money and the decision. A contribution does not, by itself, establish influence." }
      : { from: nn[3].id, to: node.id, kind: "connects", label: "follows up" },
  ];
  const refs = nn.map((n) => `[[${n.id}]]`);
  return { nodes: nn, strings, qa: { q, a: A.a(refs) }, log: [`Dug into ${shortTitle(node, 40)}: ${nn.length} new pins`] };
}
