import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { shortTitle } from "../lib/util.js";

/** Bottom "Ask Paper Trail" bar: question input, + menu (screenshot upload, share inbox, sticky note). */
const Composer = forwardRef(function Composer({ placeholder, context, onClearContext, attach, setAttach, onAsk, onOpenInbox, onAddNote, trending = [], onTrending }, ref) {
  const [text, setText] = useState("");
  const [menu, setMenu] = useState(false);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const wrapRef = useRef(null);
  useImperativeHandle(ref, () => ({ focus: () => inputRef.current && inputRef.current.focus() }));

  useEffect(() => {
    if (!menu) return;
    const close = (e) => { if (!wrapRef.current.contains(e.target)) setMenu(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menu]);

  const onFile = () => {
    const f = fileRef.current.files[0];
    fileRef.current.value = "";
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // downscale so screenshots fit in localStorage
        const s = Math.min(1, 520 / Math.max(img.width, img.height));
        const cv = document.createElement("canvas");
        cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        setAttach({ img: cv.toDataURL("image/jpeg", 0.72), name: f.name });
        inputRef.current.focus();
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(f);
  };

  const submit = (e) => {
    e.preventDefault();
    const q = text.trim();
    if (!q && !attach) return inputRef.current.focus();
    setText("");
    onAsk(q || "What's the real story behind this?");
  };

  const act = (a) => {
    setMenu(false);
    if (a === "upload") fileRef.current.click();
    if (a === "inbox") onOpenInbox();
    if (a === "note") { onAddNote(text.trim()); setText(""); }
  };

  return (
    <div className="composer-wrap">
      {!text && !context && !attach && trending.length > 0 && (
        <div className="trending" aria-label="Trending searches">
          <span className="trending-label">🔥 Trending</span>
          {trending.slice(0, 3).map((t) => (
            <button key={t.q} type="button" className="trend-chip" title={`${t.q}\nTop source: ${t.source}`} onClick={() => onTrending(t)}>
              <b>{t.label}</b><span>{t.count} looking</span>
            </button>
          ))}
        </div>
      )}
      {context && (
        <div className="composer-context">
          <span>Asking about</span><b>{shortTitle(context)}</b>
          <button type="button" aria-label="Clear" onClick={onClearContext}>✕</button>
        </div>
      )}
      {attach && (
        <div className="attach-preview">
          <img src={attach.img} alt="" /><b>{attach.name}</b><span className="muted">will be pinned when you send</span>
          <button type="button" aria-label="Remove" onClick={() => setAttach(null)}>✕</button>
        </div>
      )}
      <form className="composer" autoComplete="off" onSubmit={submit}>
        <div className="plus-wrap" ref={wrapRef}>
          <button type="button" className="plus-btn" aria-label="Add sources" onClick={() => setMenu((m) => !m)}>+</button>
          {menu && (
            <div className="plus-menu">
              <button type="button" onClick={() => act("upload")}>📷 Upload a screenshot</button>
              <button type="button" onClick={() => act("inbox")}>📥 From your share inbox</button>
              <button type="button" onClick={() => act("note")}>🗒️ Add a sticky note</button>
            </div>
          )}
        </div>
        <input type="file" ref={fileRef} accept="image/*" hidden onChange={onFile} />
        <input ref={inputRef} className="prompt" placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value)} />
        <button className="send-btn" type="submit" aria-label="Send">
          <svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </form>
    </div>
  );
});

export default Composer;
