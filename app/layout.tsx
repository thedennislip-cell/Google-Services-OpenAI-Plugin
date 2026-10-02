import type { Metadata, Viewport } from "next";
import Reflect4Widget from "./reflect4-widget";
import "./globals.css";

export const metadata: Metadata = {
  title: "Google Services — Mail, Drive & YouTube",
  description: "A private dashboard for Gmail and Google Drive, with public YouTube video search and playback.",
  applicationName: "Google Services"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f8fc"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Reflect4Widget />
        {children}
      </body>
    </html>
  );
}
