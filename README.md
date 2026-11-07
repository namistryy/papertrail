# Paper Trail: follow the story, not the headline

**Every headline has a paper trail. Follow it.**

Paper Trail is an interactive prototype of an investigative "murder board" for political stories. You send it a post from Instagram, TikTok or X (or upload a screenshot) and ask a question. Detective agents then pin up the original legislation, who introduced it, who funded it, what changed between the draft and the final version, and which claims can actually be verified, all tied together with color-coded red string.

> Illustrative product concept. The city of Riverton and every person, PAC, outlet and handle in the demo are fictional. Agent output is simulated with templates, so the prototype runs offline.

## Run it
Built with React 18 + Vite.
```
npm install
npm run dev      # local dev server
npm run build    # production build in dist/ (relative paths, so it works on GitHub Pages)
```

## Features
- **Evidence Board**: a pannable, zoomable cork board with polaroid social posts, typed documents, newspaper clippings, sticky notes and manila folders you can open. Drag pins around to rearrange them.
- **Color-coded strings**: connects, contradicts, money, verified, changed, origin trail. **Dotted strings** are *claimed* connections that aren't documented, which keeps a contribution from reading as proof of influence. Tap any string to see the evidence behind it. Use the legend to filter strings by type.
- **Detective agents**: Evidence Checker (status: verified / partially supported / contradicted / unverified, based on available evidence), Bias Hound (framing slant) and Tracer (repost chain and money). Their findings are stamped on every pin.
- **Claim vs. Evidence** profile for each post: claim, source, evidence, missing context, status.
- **Version History**: steps through a bill's versions (original → amendment → committee → final) with word-level diffs.
- **Dig deeper**: zoom into any pin and ask a follow-up, and a sub-network of new sources grows around it.
- **Story File** sidebar: a full written summary with a timeline and numbered citations that jump to the pins, for when the board gets to be too much.
- **Ask Paper Trail** bar at the bottom: the **+** menu uploads a screenshot, pulls from the share inbox, or adds your own sticky note.
- **Hamburger menu**: multiple boards (like separate chats), plus the share inbox.
- **Trending searches** above the Ask bar: the top questions and sources people are investigating. Tap one to open its board or start a new investigation.
- **Analytics**: where your information comes from, how your sources hold up, and their framing slant. Computed live from your boards.

State is saved in `localStorage`. Use "Reset demo data" in the menu to start over.

## Share a board
Use the Share board button in the header to copy a snapshot link or download a JSON board file. Friends can open the link or import the file from the same dialog. Opening a shared board adds an editable copy alongside existing boards; later edits are not synced. Snapshots include the board's notes, uploaded images, findings, and card positions.

Links carry compressed snapshot data in the URL fragment and need a publicly reachable deployment of Paper Trail. Localhost links work only on the sender's computer. Large snapshots can use the file option; both formats have a 2 MB limit. No sharing server or account is required.

Sharing checks: `node --test src/lib/shareBoard.test.js`.

## Structure
- `src/App.jsx`: app state, persistence, and the ask / generate / dig-deeper flows
- `src/components/`: `Board` (pan/zoom, strings, drag), `Card`, `Sidebar` (Story File, Inspect, Agents), `Composer`, `Drawer`, `Modals` (folder, string evidence, Version History), `Analytics`
- `src/lib/agents.js`: simulated detective agents as pure functions. Swap these for real model calls.
- `src/lib/`: constants, utilities (word diff, string geometry), localStorage store
- `src/data.js`: fictional seed boards, share inbox, trending searches
- `src/styles.css`: cork board, paper and chrome styling
