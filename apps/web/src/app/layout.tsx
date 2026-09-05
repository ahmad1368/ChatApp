import type { Metadata } from "next";
import ErrorBoundary from "./ErrorBoundary";
import GlobalErrorReporter from "./GlobalErrorReporter";

export const metadata: Metadata = {
  title: "ChatApp",
  description: "A minimal real-time chat app",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <GlobalErrorReporter />
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}
