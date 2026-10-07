import type { Metadata } from "next";
import { ThemeScript } from "@/components/theme-script";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || "Zaneva Mutasi",
  description: "Parser mutasi rekening BNI & Mandiri ke Excel",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-screen antialiased">
        {children}
        <Toaster
          richColors
          position="top-center"
          offset={{ top: "4.5rem" }}
          mobileOffset={{ top: "4.5rem" }}
        />
      </body>
    </html>
  );
}
