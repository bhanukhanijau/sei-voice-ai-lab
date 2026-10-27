import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "SEI Voice AI Lab",
  description:
    "Vapi-native voice agent development and troubleshooting sandbox",
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
