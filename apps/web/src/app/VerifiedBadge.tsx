"use client";

/** Tinder's iconic blue checkmark. A small, reusable component so any
 * future profile card / match list / chat header can show it consistently
 * next to a display name. */
export default function VerifiedBadge({ label = "Verified" }: { label?: string }) {
  return (
    <span
      title={label}
      aria-label={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 18,
        height: 18,
        borderRadius: "50%",
        background: "#3b82f6",
        marginLeft: 6,
        verticalAlign: "middle",
      }}
    >
      <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}
