import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LanguageProvider } from "../context/LanguageContext";
import { ThemeProvider, THEME_INIT_SCRIPT } from "../context/ThemeContext";
import { ToastProvider } from "../components/ui/toast";
import { ConfirmProvider } from "../components/ui/confirm";

export const metadata: Metadata = {
  title: "TG SignPulse",
  description: "TG SignPulse",
  applicationName: "TG SignPulse",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    title: "SignPulse",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#3c4b5e" },
    { media: "(prefers-color-scheme: dark)", color: "#243040" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* 在首帧渲染前应用主题，避免深色用户看到浅色闪烁 */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <LanguageProvider>
          <ThemeProvider>
            <ToastProvider>
              <ConfirmProvider>{children}</ConfirmProvider>
            </ToastProvider>
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
