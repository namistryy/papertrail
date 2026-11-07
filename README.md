# Receipts: follow the story, not the headline

**Every headline has a paper trail. Follow it.**

Receipts is an interactive prototype of an investigative "murder board" for political stories. You send it a post from Instagram, TikTok or X (or upload a screenshot) and ask a question. Detective agents then pin up the original legislation, who introduced it, who funded it, what changed between the draft and the final version, and which claims can actually be verified, all tied together with color-coded red string.

> Illustrative product concept. The city of Riverton and every person, PAC, outlet and handle in the demo are fictional. Agent output is simulated with templates, so the prototype runs offline.

## Run it
No build step. Open `index.html`, or serve the folder:
```
python -m http.server 8765
```
It also works as-is on GitHub Pages.

## Features
- **Evidence Board**: a pannable, zoomable cork board with polaroid social posts, typed documents, newspaper clippings, sticky notes and manila folders you can open. Drag pins around to rearrange them.
- **Color-coded strings**: connects, contradicts, money, verified, changed, origin trail. **Dotted strings** are *claimed* connections that aren't documented, which keeps a contribution from reading as proof of influence. Tap any string to see the evidence behind it. Use the legend to filter strings by type.
- **Detective agents**: Evidence Checker (status: verified / partially supported / contradicted / unverified, based on available evidence), Bias Hound (framing slant) and Tracer (repost chain and money). Their findings are stamped on every pin.
- **Claim vs. Evidence** profile for each post: claim, source, evidence, missing context, status.
- **Paper Trail**: steps through a bill's versions (original → amendment → committee → final) with word-level diffs.
- **Dig deeper**: zoom into any pin and ask a follow-up, and a sub-network of new sources grows around it.
- **Story File** sidebar: a full written summary with a timeline and numbered citations that jump to the pins, for when the board gets to be too much.
- **Ask Receipts** bar at the bottom: the **+** menu uploads a screenshot, pulls from the share inbox, or adds your own sticky note.
- **Hamburger menu**: multiple boards (like separate chats), plus the share inbox.
- **Discover**: browse investigations by category (Government & Policy, Elections & Campaigns, Money & Influence, International Affairs, Corporate & Political Power, Media & Misinformation).
- **Analytics**: where your information comes from, how your sources hold up, and their framing slant. Computed live from your boards.

State is saved in `localStorage`. Use "Reset demo data" in the menu to start over.

## Files
- `index.html`: layout
- `styles.css`: cork board, paper and chrome styling
- `data.js`: fictional seed boards, share inbox, Discover catalog
- `app.js`: board engine, strings, agents (simulated), Story File, Paper Trail, Discover, Analytics
