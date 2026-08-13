import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/theme/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "OpsPilot AI: Clear work, ready to use",
    template: "%s | OpsPilot AI",
  },
  description:
    "Turn bug reports, meeting notes, and rough work updates into structured, reviewable results.",
  applicationName: "OpsPilot AI",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <QueryProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <a className="skip-link" href="#main-content">
              Skip to content
            </a>
            {children}
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
