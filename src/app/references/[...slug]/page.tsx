import fs from "node:fs/promises";
import path from "node:path";

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LinkButton } from "@/components/ui/link-button";
import { linkButtonClass } from "@/components/ui/link-button-class";
import { getProjectBySlug } from "@/content/projects";
import { Section } from "@/components/ui/section";

type PageProps = {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const DOCS_ROOT = path.join(process.cwd(), "public", "docs");
const TEXT_EXTENSIONS = new Set([
  ".txt",
  ".py",
  ".md",
  ".json",
  ".js",
  ".ts",
  ".tsx",
  ".java",
  ".xml",
  ".yml",
  ".yaml",
]);

function getDocPaths(slug: string[]) {
  const unsafePath = path.resolve(DOCS_ROOT, ...slug);
  if (!unsafePath.startsWith(DOCS_ROOT)) return null;

  const relativePath = slug.join("/");
  const publicHref = `/docs/${relativePath}`;
  return { absolutePath: unsafePath, publicHref, fileName: slug[slug.length - 1] ?? "" };
}

function getFirstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const fileName = slug?.[slug.length - 1] ?? "Document";
  return {
    title: `相关文档预览 - ${fileName}`,
    description: "站内文档预览页",
  };
}

export default async function ReferencePreviewPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const docPaths = getDocPaths(slug);
  if (!docPaths) notFound();

  const { absolutePath, publicHref, fileName } = docPaths;

  try {
    const stat = await fs.stat(absolutePath);
    if (!stat.isFile()) notFound();
  } catch {
    notFound();
  }

  const extension = path.extname(fileName).toLowerCase();
  const isTextPreview = TEXT_EXTENSIONS.has(extension);
  const isPdfPreview = extension === ".pdf";

  let textContent: string | null = null;
  if (isTextPreview) {
    textContent = await fs.readFile(absolutePath, "utf8");
  }

  const from = getFirstValue(query.from);
  const projectSlug = getFirstValue(query.project);
  const blogSlug = getFirstValue(query.blog);
  const relatedProject = from === "project" && projectSlug ? getProjectBySlug(projectSlug) : undefined;
  const backHref = relatedProject
    ? `/projects/${relatedProject.slug}`
    : from === "project"
      ? "/projects"
      : from === "blog" && blogSlug
        ? `/blog/${blogSlug}`
        : "/blog";
  const backLabel = relatedProject
    ? "← 返回项目详情"
    : from === "project"
      ? "← 返回项目列表"
      : from === "blog" && blogSlug
        ? "← 返回文章详情"
        : "← 返回博客列表";

  return (
    <div id="preview-top" className="space-y-8">
      <Section className="space-y-4">
        <div className="space-y-2">
          <LinkButton href={backHref}>
            {backLabel}
          </LinkButton>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 md:text-3xl">
            {fileName}
          </h1>
          <p className="text-base text-zinc-600">相关文档预览</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={publicHref}
            download
            className={linkButtonClass({ className: "px-3 py-1.5" })}
          >
            下载原文件
          </a>
        </div>
      </Section>

      <Section>
        {isTextPreview && (
          <pre className="glass-panel max-h-[75vh] overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs leading-6 text-zinc-800 md:text-sm">
            <code>{textContent}</code>
          </pre>
        )}

        {isPdfPreview && (
          <div className="glass-panel rounded-xl border border-zinc-200 bg-white overflow-hidden bg-white">
            <iframe
              src={`${publicHref}#toolbar=1&navpanes=0&scrollbar=1`}
              title={fileName}
              className="h-[75vh] w-full"
            />
          </div>
        )}

        {!isTextPreview && !isPdfPreview && (
          <div className="glass-panel rounded-xl border border-zinc-200 bg-white p-4 text-base text-zinc-700">
            当前格式暂不支持内嵌预览，请优先使用已提供的 `txt` 或 `pdf` 文档。
          </div>
        )}
      </Section>
    </div>
  );
}





