import type { Metadata } from "next";

import { LinkButton } from "@/components/ui/link-button";
import { Section } from "@/components/ui/section";
import { aboutContent } from "@/content/about";

export const metadata: Metadata = {
  title: "关于我",
  description: "关于刘栩年的个人简介和当前关注方向。",
};

export default function AboutPage() {
  return (
    <Section
      title={aboutContent.heading}
      description="一个简要但可持续扩展的个人介绍页面。"
      headingLevel={1}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="glass-panel rounded-xl border border-zinc-200 bg-white p-5">
          <h3 className="text-base font-semibold text-zinc-900">个人简介</h3>
          <div className="mt-3 space-y-3">
            {aboutContent.paragraphs.map((paragraph) => (
              <p key={paragraph} className="text-base leading-8 text-zinc-700">
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-xl border border-zinc-200 bg-white p-5">
          <h3 className="text-base font-semibold text-zinc-900">关注方向</h3>
          <ul className="mt-3 space-y-2">
            {aboutContent.highlights.map((item) => (
              <li key={item} className="text-base leading-8 text-zinc-700">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-semibold tracking-tight text-zinc-900">经历时间线</h3>
        <ul className="grid gap-3">
          {aboutContent.timeline.map((item) => (
            <li
              key={`${item.period}-${item.title}`}
              className="glass-panel rounded-xl border border-zinc-200 bg-white p-4"
            >
              <p className="text-xs text-zinc-500">{item.period}</p>
              <p className="mt-1 text-lg font-semibold text-zinc-900">{item.title}</p>
              <p className="mt-2 text-base leading-8 text-zinc-600">{item.detail}</p>
              <LinkButton
                href={`/projects/${item.projectSlug}?from=about`}
                className="mt-3 w-fit"
              >
                查看对应项目
              </LinkButton>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}





