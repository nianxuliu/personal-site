import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LinkButton } from "@/components/ui/link-button";
import { Section } from "@/components/ui/section";
import { SharedLayout } from "@/components/ui/shared-layout";
import { getBlogPostBySlug, blogPosts } from "@/content/blog";
import { getProjectBySlug } from "@/content/projects";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    return {
      title: "文章不存在",
    };
  }

  return {
    title: post.title,
    description: post.excerpt,
  };
}

export default async function BlogDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const relatedProject = post.sourceProject ? getProjectBySlug(post.sourceProject) : undefined;

  return (
    <div className="space-y-12">
      <Section className="space-y-5">
        <LinkButton href="/blog">
          ← 返回文章列表
        </LinkButton>
        <div className="space-y-3">
          <SharedLayout layoutId={`post-meta-${post.slug}`}>
            <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-500">
              <time dateTime={post.date}>{post.date}</time>
              <span>{post.readingTime}</span>
              <span className="glass-chip inline-flex items-center rounded-lg border border-zinc-200 bg-zinc-100 px-2 py-[2px] text-xs text-zinc-600">
                {post.status}
              </span>
            </div>
          </SharedLayout>
          <SharedLayout layoutId={`post-title-${post.slug}`}>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 md:text-4xl">
              {post.title}
            </h1>
          </SharedLayout>
          <SharedLayout layoutId={`post-excerpt-${post.slug}`}>
            <p className="max-w-4xl text-base leading-8 text-zinc-700">{post.intro}</p>
          </SharedLayout>
        </div>
        {relatedProject && (
          <LinkButton
            href={`/projects/${relatedProject.slug}?from=blog&blog=${post.slug}`}
            className="w-fit"
          >
            查看关联项目：{relatedProject.name}
          </LinkButton>
        )}
        {post.referenceDocs && post.referenceDocs.length > 0 && (
          <div className="space-y-2">
            <p className="text-base font-medium text-zinc-700">相关文档：</p>
            <div className="flex flex-wrap gap-2">
              {post.referenceDocs.map((doc) => (
                <LinkButton
                  key={doc.href}
                  href={`${doc.href}?from=blog&blog=${post.slug}`}
                  className="px-3 py-1.5"
                >
                  {doc.label}
                </LinkButton>
              ))}
            </div>
          </div>
        )}
      </Section>

      {post.sections.map((section) => (
        <Section key={section.heading} title={section.heading}>
          <div className="space-y-4">
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="whitespace-pre-line text-base leading-8 text-zinc-700">
                {paragraph}
              </p>
            ))}
          </div>

          {section.bullets && section.bullets.length > 0 && (
            <ul className="grid gap-3">
              {section.bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="glass-panel rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base leading-8 text-zinc-700"
                >
                  {bullet}
                </li>
              ))}
            </ul>
          )}

          {section.code && (
            <pre className="glass-panel overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs leading-6 text-zinc-800 md:text-sm">
              <code className={`language-${section.codeLanguage ?? "text"}`}>{section.code}</code>
            </pre>
          )}
        </Section>
      ))}
    </div>
  );
}





