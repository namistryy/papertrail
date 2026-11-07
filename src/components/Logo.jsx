import React from "react";

/* Paper Trail brand.
   Mark: a lowercase "p" whose stem breaks off into a dotted trail. The "p" leaves a trail.
   Wordmark: lowercase grotesk, and the dot on the "i" is the trail's red dot.
   Flat, two colors, no gradients. Keep it that way. */

export function LogoMark({ size = 28 }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--brand, #e0483a)" />
      <g fill="none" stroke="#fff8f0" strokeWidth="3.4" strokeLinecap="round">
        <path d="M11.5 9.5V19.5" />
        <circle cx="16.8" cy="14.3" r="5.1" />
      </g>
      <circle cx="11.6" cy="24" r="1.7" fill="#fff8f0" />
      <circle cx="13.6" cy="27.9" r="1.35" fill="#fff8f0" opacity=".7" />
    </svg>
  );
}

/** Bullet for agent activity logs: the trail dot from the wordmark. */
export function TrailPin({ size = 10 }) {
  return (
    <svg className="trail-pin" width={size} height={size} viewBox="0 0 10 10" aria-hidden="true">
      <circle cx="5" cy="5" r="4" fill="var(--brand, #e0483a)" />
    </svg>
  );
}

export default function Logo() {
  return (
    <span className="logo" aria-label="Paper Trail">
      <span className="logo-word" aria-hidden="true">
        paper tra<span className="i-dot">ı</span>l
      </span>
    </span>
  );
}
