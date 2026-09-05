"use client";

const SHORTCUTS: [string, string][] = [
  ["Enter", "Send message"],
  ["Shift + Enter", "New line"],
  ["Ctrl / Cmd + K", "Focus the message box"],
  ["Esc", "Close this help / unfocus"],
  ["?", "Toggle this help"],
];

export default function KeyboardShortcutsHelp({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 8, padding: 20, minWidth: 260, fontSize: 14 }}
      >
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Keyboard shortcuts</h2>
        <table>
          <tbody>
            {SHORTCUTS.map(([keys, description]) => (
              <tr key={keys}>
                <td style={{ padding: "4px 12px 4px 0", fontFamily: "monospace", whiteSpace: "nowrap" }}>{keys}</td>
                <td style={{ padding: "4px 0", color: "#4b5563" }}>{description}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={onClose} style={{ marginTop: 12 }}>
          Close
        </button>
      </div>
    </div>
  );
}
