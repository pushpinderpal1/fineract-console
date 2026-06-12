import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fineract Console",
  description: "Sandbox console for Apache Fineract operations.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
