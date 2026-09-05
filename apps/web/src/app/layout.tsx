import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ChatApp",
  description: "A minimal real-time chat app",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
