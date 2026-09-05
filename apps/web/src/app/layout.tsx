import type { Metadata } from "next";
import UpdateNotifier from "./UpdateNotifier";

export const metadata: Metadata = {
  title: "ChatApp",
  description: "A minimal real-time chat app",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <UpdateNotifier />
      </body>
    </html>
  );
}
