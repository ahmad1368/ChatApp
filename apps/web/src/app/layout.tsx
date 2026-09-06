import type { Metadata, Viewport } from "next";
import { LocaleProvider } from "./LocaleProvider";
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

// Applies a stored locale's lang/dir and a stored theme override before
// first paint, so switching either (especially into/out of RTL) doesn't
// flash the previous layout/theme on reload.
const prePaintInitScript = `
(function () {
  try {
    var storedLocale = window.localStorage.getItem("chatapp:locale");
    if (storedLocale === "fa") {
      document.documentElement.lang = "fa";
      document.documentElement.dir = "rtl";
    }
    var storedTheme = window.localStorage.getItem("chatapp:theme");
    if (storedTheme === "light" || storedTheme === "dark") {
      document.documentElement.setAttribute("data-theme", storedTheme);
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <head>
        <script dangerouslySetInnerHTML={{ __html: prePaintInitScript }} />
      </head>
      <body>
        <LocaleProvider>{children}</LocaleProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
