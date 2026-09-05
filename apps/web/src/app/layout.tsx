import type { Metadata } from "next";
import { LocaleProvider } from "./LocaleProvider";

export const metadata: Metadata = {
  title: "ChatApp",
  description: "A minimal real-time chat app",
};

// Applies a stored locale's lang/dir before first paint so switching
// languages (especially into/out of RTL) doesn't flash the previous layout.
const localeInitScript = `
(function () {
  try {
    var stored = window.localStorage.getItem("chatapp:locale");
    if (stored === "fa") {
      document.documentElement.lang = "fa";
      document.documentElement.dir = "rtl";
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <head>
        <script dangerouslySetInnerHTML={{ __html: localeInitScript }} />
      </head>
      <body>
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
