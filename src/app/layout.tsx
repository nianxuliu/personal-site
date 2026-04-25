import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { KeywordBackground } from "@/components/layout/keyword-background";
import { SiteHeader } from "@/components/layout/site-header";
import { Container } from "@/components/ui/container";
import { linkButtonClass } from "@/components/ui/link-button-class";
import { PageTransition } from "@/components/ui/page-transition";
import { ParticleRouteTransition } from "@/components/ui/particle-route-transition";
import { siteConfig } from "@/content/site";
import "@/styles/globals.css";

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
    default: siteConfig.title,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-[17px] leading-8 text-foreground">
        <KeywordBackground />
        <div id="page-top" className="relative z-10 flex min-h-screen flex-col">
          <SiteHeader />
          <main id="page-main" className="flex-1 pt-0 pb-12 md:pb-16">
            <Container>
              <PageTransition>{children}</PageTransition>
            </Container>
          </main>
        </div>

        <a
          href="#page-top"
          className={linkButtonClass({
            className: "fixed bottom-5 right-5 z-[80] whitespace-nowrap",
          })}
          style={{ left: "auto" }}
        >
          返回顶部
        </a>

        <ParticleRouteTransition />
      </body>
    </html>
  );
}
