import type { Metadata, Viewport } from "next";
import PwaRegister from "./PwaRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChatApp",
  description: "A minimal real-time chat app",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#e11d48",
  width: "device-width",
  initialScale: 1,
};

// Applies a stored theme override before first paint so switching themes
// doesn't flash the previous one on reload.
const themeInitScript = `
(function () {
  try {
    var stored = window.localStorage.getItem("chatapp:theme");
    if (stored === "light" || stored === "dark") {
      document.documentElement.setAttribute("data-theme", stored);
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
