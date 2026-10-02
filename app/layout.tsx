import type { Metadata, Viewport } from "next";
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
  return ( <html lang="en">
      <head>
        <script async src="https://www-reflect4.run.place/widget/widget.js" data-id="r4-widget-connection"></script>
      </head>
      <body>
        <div id="r4-widget-form"></div>
        {children}
      </body>
    </html>
  );
}
