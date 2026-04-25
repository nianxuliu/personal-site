import type { Metadata } from "next";
import Link from "next/link";

import { Section } from "@/components/ui/section";
import { siteConfig } from "@/content/site";
import { socialLinks } from "@/content/social-links";

export const metadata: Metadata = {
  title: "联系我",
  description: "联系方式与社交账号。",
};

export default function ContactPage() {
  return (
    <Section
      title="联系我"
      description="欢迎通过邮箱或社交平台联系我。"
      headingLevel={1}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <article className="glass-panel rounded-xl border border-zinc-200 bg-white p-6">
          <h3 className="text-base font-medium text-zinc-500">邮箱</h3>
          <Link
            href={`mailto:${siteConfig.email}`}
            className="mt-2 inline-block text-base font-semibold text-zinc-900 hover:underline"
          >
            {siteConfig.email}
          </Link>
        </article>

        <article className="glass-panel rounded-xl border border-zinc-200 bg-white p-6">
          <h3 className="text-base font-medium text-zinc-500">电话</h3>
          <Link
            href={`tel:${siteConfig.phone}`}
            className="mt-2 inline-block text-base font-semibold text-zinc-900 hover:underline"
          >
            {siteConfig.phone}
          </Link>
        </article>

        <article className="glass-panel rounded-xl border border-zinc-200 bg-white p-6">
          <h3 className="text-base font-medium text-zinc-500">所在地</h3>
          <p className="mt-2 inline-block text-base font-semibold text-zinc-900">
            {siteConfig.location}
          </p>
        </article>

        {socialLinks.map((link) => (
          <article key={link.label} className="glass-panel rounded-xl border border-zinc-200 bg-white p-6">
            <h3 className="text-base font-medium text-zinc-500">{link.label}</h3>
            <Link
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-base font-semibold text-zinc-900 hover:underline"
            >
              {link.value}
            </Link>
          </article>
        ))}
      </div>
    </Section>
  );
}





