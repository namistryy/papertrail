export const STORE_KEY = "receipts_v1";

export const KINDS = {
  connects:    { label: "Connects / supports", color: "var(--s-connects)" },
  contradicts: { label: "Contradicts",         color: "var(--s-contradicts)" },
  money:       { label: "Money / funding",     color: "var(--s-money)" },
  verified:    { label: "Verified against",    color: "var(--s-verified)" },
  changed:     { label: "Changed / amended",   color: "var(--s-changed)" },
  origin:      { label: "Origin trail (repost)", color: "var(--s-origin)" },
};

export const PIN = { post: "#c0392b", shot: "#c0392b", doc: "#2f6fd6", note: "#333", folder: "#d39a12", clip: "#1f9d55" };

export const VERDICT = {
  verified:     { label: "Verified", icon: "✓" },
  partial:      { label: "Partially supported", short: "Partial", icon: "≈" },
  contradicted: { label: "Contradicted", icon: "✗" },
  unverified:   { label: "Unverified", icon: "?" },
};

export const AGENTS = {
  "Bias Hound":       { ic: "🐕", role: "Framing, loaded language, who benefits" },
  "Evidence Checker": { ic: "🔎", role: "Checks claims against primary sources" },
  "Tracer":           { ic: "🧭", role: "Follows reposts upstream & maps the money" },
  "You":              { ic: "✍️", role: "Your own note" },
};

export const PLATFORMS = ["TikTok", "Instagram", "X"];

export const LEAN_LABELS = ["Strongly for", "Leans for", "Neutral", "Leans against", "Strongly against"];

export const statusVar = (v) => ({ verified: "good", partial: "warning", contradicted: "critical" }[v] || "neutral");
