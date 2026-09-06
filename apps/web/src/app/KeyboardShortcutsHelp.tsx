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
    <div role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" className="chat-app__modal-overlay" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="chat-app__modal">
        <h2 className="chat-app__modal-title">Keyboard shortcuts</h2>
        <table className="chat-app__shortcuts-table">
          <tbody>
            {SHORTCUTS.map(([keys, description]) => (
              <tr key={keys}>
                <td className="chat-app__shortcuts-keys">{keys}</td>
                <td className="chat-app__shortcuts-description">{description}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="chat-app__send" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
