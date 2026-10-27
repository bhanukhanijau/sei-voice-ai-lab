import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "SEI Voice AI Lab",
  description:
    "Talk to SEI Outdoors’ AI support agent about orders, returns, and outdoor gear. Watch real tools work with fictional demo data.",
  icons: { icon: "/brand/sei-mark.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
