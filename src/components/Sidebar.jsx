import React from "react";
import { AGENTS, KINDS, VERDICT, LEAN_LABELS } from "../lib/constants.js";
import { shortTitle } from "../lib/util.js";
import { TrailPin } from "./Logo.jsx";

/** Renders text with [[nodeId]] citations as numbered buttons that jump to the pin. */
export function RefText({ text, board, onRef }) {
  const parts = String(text).split(/(\[\[[\w-]+\]\])/g);
  return parts.map((p, i) => {
    const m = p.match(/^\[\[([\w-]+)\]\]$/);
    if (!m) return <React.Fragment key={i}>{p}</React.Fragment>;
    const idx = board.nodes.findIndex((n) => n.id === m[1]);
    if (idx < 0) return null;
    return (
      <button key={i} className="ref" title={shortTitle(board.nodes[idx])} onClick={() => onRef(m[1])}>{idx + 1}</button>
    );
  });
}

function AgentCard({ name, children }) {
  const a = AGENTS[name];
  return (
    <div className="agent-card">
      <div className="agent-head">
        <span className="agent-ava">{a.ic}</span>
        <div><div className="agent-name">{name}</div><div className="agent-role">{a.role}</div></div>
      </div>
      {children}
    </div>
  );
}

function StoryFile({ board, onRef }) {
  if (!board.nodes.length) {
    return (
      <div className="empty-insp"><div className="big">🗂️</div>No Story File yet.<br />Ask a question below and a written summary will build here alongside the board, for when the strings get overwhelming.</div>
    );
  }
  const sources = board.nodes.filter((n) => n.type !== "note").length;
  const docd = board.strings.filter((x) => !x.claimed).length;
  return (
    <>
      <div className="sf-kicker">Story File{board.category ? " · " + board.category : ""}{board.location ? " · " + board.location : ""}</div>
      <div className="sum-q">{board.question || board.title}</div>
      {board.disclaimer && <div className="sum-disclaimer">{board.disclaimer}</div>}
      <div className="sum-meta">{sources} sources · {docd} documented connections · {board.strings.length - docd} claimed. Read it here as text if the board gets to be too much. The numbers jump to the pin.</div>
      {(board.summary || []).map((s, i) => (
        <div className="sum-sec" key={i}><h3>{s.h}</h3><p><RefText text={s.p} board={board} onRef={onRef} /></p></div>
      ))}
      {board.timeline && board.timeline.length > 0 && (
        <div className="sum-sec">
          <h3>Timeline</h3>
          <ol className="tl">
            {board.timeline.map((t, i) => (
              <li key={i}><span className="tl-d">{t.d}</span><span>{t.t} {t.ref && <RefText text={`[[${t.ref}]]`} board={board} onRef={onRef} />}</span></li>
            ))}
          </ol>
        </div>
      )}
      {(board.qa || []).length > 0 && <div className="sum-sec"><h3>Ask Paper Trail</h3></div>}
      {(board.qa || []).map((q, i) => (
        <div className="qa" key={i}>
          <div className="qa-q">{q.q}</div>
          <p><RefText text={q.a} board={board} onRef={onRef} /></p>
          <div className="qa-src">Answered only from sources on this board</div>
        </div>
      ))}
    </>
  );
}

function ClaimProfile({ n, board, onGoto }) {
  const c = n.checks;
  const ev = board.strings
    .filter((x) => (x.from === n.id || x.to === n.id) && (x.kind === "verified" || x.kind === "contradicts"))
    .map((x) => board.nodes.find((m) => m.id === (x.from === n.id ? x.to : x.from)))
    .filter(Boolean);
  const verdict = c.validity ? c.validity.verdict : "unverified";
  const v = VERDICT[verdict];
  return (
    <table className="claim-tbl">
      <caption>Claim vs. Evidence</caption>
      <tbody>
        <tr><th>Claim</th><td>{String(n.title).replace(/^"|"$/g, "")}</td></tr>
        <tr><th>Source</th><td>{(n.handle || "Uploaded screenshot") + (n.platform && n.platform !== "Upload" ? " on " + n.platform : "")}</td></tr>
        <tr><th>Evidence</th><td>
          {ev.length ? ev.map((o) => (
            <div key={o.id}><button className="link-btn inline" onClick={() => onGoto(o.id)}>{shortTitle(o, 40)}</button></div>
          )) : <span className="muted">No documentation linked yet</span>}
        </td></tr>
        <tr><th>Context</th><td>{c.context || "Agents flag what's missing. Dig deeper to fill the gaps."}</td></tr>
        <tr><th>Status</th><td>
          <span className={"verdict " + verdict}>{v.icon} {v.label}</span>
          <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>based on available evidence</div>
        </td></tr>
      </tbody>
    </table>
  );
}

function followUps(n) {
  if (n.type === "post" || n.type === "shot") return ["Who posted this first?", "Is this claim true?", "Who's behind this account?"];
  if (n.type === "folder") return ["Who funded this?", "Any conflicts of interest?"];
  if (n.type === "doc") return ["What changed from the original?", "Who introduced this?", "Explain it simply"];
  if (n.type === "clip") return ["Is this outlet biased?", "What did they leave out?"];
  return ["Find more sources on this", "Is this verified?"];
}

function Inspect({ board, n, actions }) {
  if (!n) {
    return (
      <div className="empty-insp"><div className="big">📌</div>Tap any pin on the board to inspect it.<br />You'll see what each detective agent found, and you can dig deeper to grow a sub-board of related sources.</div>
    );
  }
  const typeName = { post: n.platform + " post", shot: "Your screenshot", doc: "Document", note: "Sticky note", folder: "Folder", clip: "News clipping" }[n.type];
  const conns = board.strings.filter((s) => s.from === n.id || s.to === n.id);
  const c = n.checks;
  return (
    <>
      <div className="insp-type">{typeName}{n.handle ? " · " + n.handle : ""}{n.date ? " · " + n.date : ""}</div>
      <h2 className="insp-title">{n.title}</h2>
      {n.type === "note" && n.agent === "You" ? (
        <textarea className="btn" style={{ width: "100%", minHeight: 90, resize: "vertical", font: "15px var(--font-ui)", textAlign: "left" }}
          value={n.body} onChange={(e) => actions.editNote(n.id, e.target.value)} />
      ) : n.body ? <div className="insp-body">{n.body}</div> : null}
      {n.type === "shot" && <img src={n.img} alt="" style={{ width: "100%", borderRadius: 8, marginBottom: 8 }} />}
      {n.files && <div className="insp-body">{n.files.map((f, i) => <div key={i}>• <b>{f.t}</b>: {f.d}</div>)}</div>}
      {(n.agent === "You" || n.type === "shot") && <div className="pending">⏳ Your addition. It goes to review before it joins the reviewed Story File.</div>}
      {(n.type === "post" || n.type === "shot") && c && <ClaimProfile n={n} board={board} onGoto={actions.goto} />}

      <div className="insp-actions">
        <button className="btn primary" onClick={() => actions.dig(n.id)}>🧵 Dig deeper</button>
        <button className="btn" onClick={() => actions.focus(n.id)}>🔍 Zoom in</button>
        {n.type === "folder" && <button className="btn" onClick={() => actions.openFolder(n.id)}>📂 Open</button>}
        {(n.versions || n.versionsOf) && <button className="btn" onClick={() => actions.openPaperTrail(n.id)}>📜 Version History</button>}
        <button className="btn" title="Remove from board" onClick={() => actions.remove(n.id)}>🗑</button>
      </div>
      <div className="chips">
        {followUps(n).map((q) => <button key={q} className="chip" onClick={() => actions.ask(q)}>{q}</button>)}
      </div>

      {c ? (
        <>
          <div className="drawer-label" style={{ margin: "4px 0 10px" }}>Detective agents</div>
          {c.validity && (
            <AgentCard name="Evidence Checker">
              <span className={"verdict " + c.validity.verdict}>{VERDICT[c.validity.verdict].icon} {VERDICT[c.validity.verdict].label}</span>
              <p>{c.validity.note}</p>
            </AgentCard>
          )}
          {c.bias && (
            <AgentCard name="Bias Hound">
              <b>{c.bias.label}</b>
              <div className="lean" role="img" aria-label={`Slant ${c.bias.lean} on a scale of -2 to 2`}>
                <span className="lean-mark" style={{ left: ((c.bias.lean + 2) / 4) * 100 + "%" }} />
              </div>
              <div className="lean-scale"><span>{LEAN_LABELS[0]}</span><span>Neutral</span><span>{LEAN_LABELS[4]}</span></div>
              <p>{c.bias.note}</p>
            </AgentCard>
          )}
          {c.origin && (
            <AgentCard name="Tracer">
              <b>Where it came from</b>
              <ul className="chain">{c.origin.chain.map((x, i) => <li key={i}>{x}</li>)}</ul>
              <p style={{ marginTop: 0 }}>{c.origin.note}</p>
            </AgentCard>
          )}
        </>
      ) : n.agent && n.agent !== "You" ? <p className="muted">Written by the {n.agent} agent.</p> : null}

      {conns.length > 0 && (
        <>
          <div className="drawer-label" style={{ margin: "16px 0 6px" }}>Strings ({conns.length})</div>
          {conns.map((s) => {
            const other = board.nodes.find((m) => m.id === (s.from === n.id ? s.to : s.from));
            const i = board.strings.indexOf(s);
            return other ? (
              <button key={i} className="board-item" onClick={() => actions.openEvidence(i)}>
                <span className="sw" style={{ background: KINDS[s.kind].color, marginTop: 5 }} />
                <span>
                  <span className="t">{shortTitle(other, 52)}</span>
                  <span className="m" style={{ display: "block" }}>{s.label || KINDS[s.kind].label}{s.claimed ? " · claimed" : ""}</span>
                </span>
              </button>
            ) : null;
          })}
        </>
      )}
    </>
  );
}

function AgentsTab({ board }) {
  const checked = board.nodes.filter((n) => n.checks);
  const cnt = (v) => checked.filter((n) => n.checks.validity && n.checks.validity.verdict === v).length;
  const slanted = checked.filter((n) => n.checks.bias && n.checks.bias.lean !== 0).length;
  const hops = checked.filter((n) => n.checks.origin).map((n) => n.checks.origin.chain.length);
  const avg = hops.length ? (hops.reduce((a, c) => a + c, 0) / hops.length).toFixed(1) : "–";
  return (
    <>
      <div className="drawer-label" style={{ margin: "0 0 8px" }}>Activity log</div>
      {(board.log || []).length
        ? (
          <ol className="log-trail">
            {board.log.slice().reverse().map((l, i) => (
              <li key={i}><TrailPin /><span>{l}</span></li>
            ))}
          </ol>
        )
        : <p className="muted">Nothing yet.</p>}

      <details className="agents-panel">
        <summary>About the agents</summary>
        <p className="muted" style={{ marginTop: 10 }}>Three detective agents work every board. Each one stamps its findings on the pins and writes sticky notes when something's off.</p>
      <AgentCard name="Evidence Checker">
        <p>Builds an evidence profile for every claim (claim, source, evidence, missing context, status) from primary sources. It isn't a true/false meter: predictions and value judgments get labelled as such.</p>
        <div className="stat">This board: ✓ {cnt("verified")} verified · ≈ {cnt("partial")} partial · ✗ {cnt("contradicted")} contradicted · ? {cnt("unverified")} unverified</div>
      </AgentCard>
      <AgentCard name="Bias Hound">
        <p>Scores framing and loaded language, and flags undisclosed sponsorships and who benefits.</p>
        <div className="stat">This board: {slanted} of {checked.length} sources slanted</div>
      </AgentCard>
      <AgentCard name="Tracer">
        <p>Follows reposts and stitches back to the original source, and follows money through public finance records.</p>
        <div className="stat">This board: avg {avg} hops from original</div>
      </AgentCard>
      </details>
    </>
  );
}

export default function Sidebar({ board, selectedNode, tab, setTab, open, actions }) {
  return (
    <aside className={"sidebar" + (open ? "" : " closed")}>
      <div className="tabs" role="tablist">
        {[["summary", "Story File"], ["inspect", "Inspect"], ["agents", "Agents"]].map(([k, label]) => (
          <button key={k} className={"tab" + (tab === k ? " active" : "")} role="tab" onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      <div className="tab-body" ref={actions.summaryRef}>
        {tab === "summary" && <StoryFile board={board} onRef={actions.gotoRef} />}
        {tab === "inspect" && <Inspect board={board} n={selectedNode} actions={actions} />}
        {tab === "agents" && <AgentsTab board={board} />}
      </div>
    </aside>
  );
}
