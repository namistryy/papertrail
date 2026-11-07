import React, { useEffect, useRef, useState } from 'react';
import { createShareURL, snapshotJSON, parseSnapshot } from '../lib/shareBoard.js';

export default function ShareBoardModal({ board, incoming, importError, onClose, onImport }) {
  const [url, setURL] = useState('');
  const [error, setError] = useState(importError || '');
  const [notice, setNotice] = useState('');
  const input = useRef(null);
  const fileInput = useRef(null);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  useEffect(() => {
    if (incoming || importError) return;
    let active = true;
    createShareURL(board).then(link => { if (active) setURL(link); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [board, incoming, importError]);
  async function copy() {
    try { await navigator.clipboard.writeText(url); setNotice('Link copied!'); }
    catch { input.current?.focus(); input.current?.select(); setNotice('Select and copy the link above.'); }
  }
  function download() {
    try {
      const objectURL = URL.createObjectURL(new Blob([snapshotJSON(board)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = objectURL; a.download = 'paper-trail-board.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(objectURL), 1000); setNotice('Board file downloaded.');
    } catch(e) { setError(e.message); }
  }
  async function importFile(event) {
    const file = event.target.files?.[0]; if (!file) return;
    try { if (file.size > 2_000_000) throw new Error('This board exceeds the 2 MB sharing limit.'); onImport(parseSnapshot(await file.text())); }
    catch(e) { setError(e.message); }
    finally { event.target.value = ''; }
  }
  return <div className="modal" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="modal-card share-board" role="dialog" aria-modal="true" aria-labelledby="share-board-title">
      <button className="close" aria-label="Close" onClick={onClose}>✕</button>
      <h3 id="share-board-title">{incoming ? 'Open a shared board' : importError ? 'Board link unavailable' : 'Share board'}</h3>
      {incoming ? <>
        <p><b>{incoming.title}</b></p><p>{incoming.nodes.length} pins · {incoming.strings.length} connections</p>
        <p>Open your own editable copy. Your existing boards will stay saved.</p>
        <button className="btn primary" onClick={() => onImport(incoming)}>Open board copy</button>
      </> : !importError && <>
        <p>Share a snapshot of <b>{board.title}</b>, including its sources, findings, notes, and card positions.</p>
        <p className="muted">Friends get their own editable copy. Later changes are not synced.</p>
        {local && <p className="share-local-note">This preview runs on your computer. Friends need a publicly hosted copy of Paper Trail to open a link. For now, send the board file; they can import it using Share board.</p>}
        <label className="share-link-label" htmlFor="share-board-link">Board link</label>
        <input id="share-board-link" ref={input} className="share-link" readOnly value={url} placeholder={error ? 'Link unavailable — use a board file' : 'Preparing link…'} onFocus={e => e.target.select()} />
        <div className="insp-actions">
          <button className="btn primary" disabled={!url} onClick={copy}>Copy link</button>
          <button className="btn" onClick={download}>Download board</button>
        </div>
        <p className="agent-detail-meta">Anyone with the link or file can read the included content. Share only what you want others to see.</p>
      </>}
      <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={importFile} />
      {!incoming && <button className="btn" onClick={() => fileInput.current?.click()}>Import board file</button>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </div>
  </div>;
}
