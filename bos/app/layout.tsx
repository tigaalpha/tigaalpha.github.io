import type { Metadata, Viewport } from "next";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { BASE_PATH } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Tiga AI BOS",
  description: "AI Business Operating System for Tiga Studio",
  manifest: `${BASE_PATH}/manifest.webmanifest`,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FF5FA2",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-page font-sans antialiased">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
