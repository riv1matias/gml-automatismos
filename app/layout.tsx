import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GML | Portal de socios",
  description: "Portal interno de automatismos - GML",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
