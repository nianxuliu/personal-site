import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LinkButton } from "@/components/ui/link-button";
import { Section } from "@/components/ui/section";
import { SharedLayout } from "@/components/ui/shared-layout";
import { getProjectBySlug, projects } from "@/content/projects";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getFirstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function toNumberedBlock(lines: string[]) {
  return lines.map((line, index) => `${index + 1}. ${line}`).join("\n");
}

function toModulesBlock(
  modules: Array<{
    name: string;
    details: string[];
  }>,
) {
  return modules
    .map((module, index) => {
      const detailBlock = module.details.map((detail) => `- ${detail}`).join("\n");
      return `${index + 1}. ${module.name}\n${detailBlock}`;
    })
    .join("\n\n");
}

function toWorkflowsBlock(
  workflows: Array<{
    title: string;
    steps: string[];
  }>,
) {
  return workflows
    .map((workflow, index) => {
      const stepBlock = workflow.steps.map((step) => `- ${step}`).join("\n");
      return `${index + 1}. ${workflow.title}\n${stepBlock}`;
    })
    .join("\n\n");
}

function toCodeInsightsBlock(
  codeInsights: Array<{
    title: string;
    detail: string;
  }>,
) {
  return codeInsights
    .map((insight, index) => `${index + 1}. ${insight.title}\n${insight.detail}`)
    .join("\n\n");
}

export function generateStaticParams() {
  return projects.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = getProjectBySlug(slug);

  if (!project) {
    return {
      title: "项目不存在",
    };
  }

  return {
    title: project.name,
    description: project.summary,
  };
}

export default async function ProjectDetailPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const project = getProjectBySlug(slug);

  if (!project) {
    notFound();
  }

  const metricsBlock = project.metrics
    .map((metric, index) => {
      const note = metric.note ? `（${metric.note}）` : "";
      return `${index + 1}. ${metric.label}：${metric.value}${note}`;
    })
    .join("\n");

  const from = getFirstValue(query.from);
  const blogSlug = getFirstValue(query.blog);
  const backHref =
    from === "about"
      ? "/about"
      : from === "blog" && blogSlug
        ? `/blog/${blogSlug}`
        : from === "blog"
          ? "/blog"
          : "/projects";
  const backLabel =
    from === "about"
      ? "← 返回关于我"
      : from === "blog" && blogSlug
        ? "← 返回文章详情"
        : from === "blog"
          ? "← 返回博客列表"
          : "← 返回项目列表";

  return (
    <div className="space-y-12">
      <Section className="space-y-5">
        <LinkButton href={backHref}>
          {backLabel}
        </LinkButton>

        <div className="space-y-3">
          <SharedLayout layoutId={`project-meta-${project.slug}`}>
            <p className="text-base text-zinc-500">
              {project.period} · {project.role}
            </p>
          </SharedLayout>
          <SharedLayout layoutId={`project-title-${project.slug}`}>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 md:text-4xl">
              {project.name}
            </h1>
          </SharedLayout>
          <SharedLayout layoutId={`project-summary-${project.slug}`}>
            <p className="max-w-4xl text-base leading-8 text-zinc-700">{project.overview}</p>
          </SharedLayout>
        </div>

        <ul className="flex flex-wrap gap-2">
          {project.techStack.map((tech) => (
            <li
              key={`${project.slug}-${tech}`}
              className="glass-chip inline-flex items-center rounded-lg border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-600"
            >
              {tech}
            </li>
          ))}
        </ul>

        <div className="glass-panel rounded-xl border border-zinc-200 bg-white p-5">
          <p className="whitespace-pre-line text-base leading-8 text-zinc-700">{metricsBlock}</p>
        </div>

        {project.repoUrl && (
          <LinkButton
            href={project.repoUrl}
            target="_blank"
            rel="noreferrer"
            className="w-fit"
          >
            查看仓库
          </LinkButton>
        )}
      </Section>

      <Section title="项目背景">
        <div className="glass-panel rounded-xl border border-zinc-200 bg-white p-5">
          <p className="whitespace-pre-line text-base leading-8 text-zinc-700">
            {toNumberedBlock(project.context)}
          </p>
        </div>
      </Section>

      <Section title="相关文档预览">
        {project.referenceDocs && project.referenceDocs.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {project.referenceDocs.map((doc) => (
              <LinkButton
                key={`${project.slug}-${doc.href}`}
                href={`${doc.href}?from=project&project=${project.slug}`}
                className="px-3 py-1.5"
              >
                {doc.label}
              </LinkButton>
            ))}
          </div>
        ) : (
          <p className="text-base leading-8 text-zinc-600">
            该项目暂未整理可预览文档，后续补充后会在这里更新。
          </p>
        )}
      </Section>

      <Section title="要解决的问题">
        <div className="glass-panel rounded-xl border border-zinc-200 bg-white p-5">
          <p className="whitespace-pre-line text-base leading-8 text-zinc-700">
            {toNumberedBlock(project.problemStatement)}
          </p>
        </div>
      </Section>

      <Section title="我负责的部分">
        <div className="glass-panel rounded-xl border border-zinc-200 bg-white p-5">
          <p className="whitespace-pre-line text-base leading-8 text-zinc-700">
            {toNumberedBlock(project.responsibilities)}
          </p>
        </div>
      </Section>

      <Section title="系统架构">
        <div className="glass-panel rounded-xl border border-zinc-200 bg-white p-5">
          <p className="whitespace-pre-line text-base leading-8 text-zinc-700">
            {toNumberedBlock(project.architecture)}
          </p>
        </div>
      </Section>

      <Section title="模块拆解">
        <div className="glass-panel rounded-xl border border-zinc-200 bg-white p-5">
          <p className="whitespace-pre-line text-base leading-8 text-zinc-700">
            {toModulesBlock(project.modules)}
          </p>
        </div>
      </Section>

      <Section title="关键流程">
        <div className="glass-panel rounded-xl border border-zinc-200 bg-white p-5">
          <p className="whitespace-pre-line text-base leading-8 text-zinc-700">
            {toWorkflowsBlock(project.workflows)}
          </p>
        </div>
      </Section>

      <Section title="代码级实现要点">
        <div className="glass-panel rounded-xl border border-zinc-200 bg-white p-5">
          <p className="whitespace-pre-line text-base leading-8 text-zinc-700">
            {toCodeInsightsBlock(project.codeInsights)}
          </p>
        </div>
      </Section>

      <Section title="核心亮点">
        <div className="glass-panel rounded-xl border border-zinc-200 bg-white p-5">
          <p className="whitespace-pre-line text-base leading-8 text-zinc-700">
            {toNumberedBlock(project.highlights)}
          </p>
        </div>
      </Section>

      {project.challenges && project.challenges.length > 0 && (
        <Section title="难点与取舍">
          <div className="glass-panel rounded-xl border border-zinc-200 bg-white p-5">
            <p className="whitespace-pre-line text-base leading-8 text-zinc-700">
              {toNumberedBlock(project.challenges)}
            </p>
          </div>
        </Section>
      )}

      <Section title="结果与收获">
        <div className="glass-panel rounded-xl border border-zinc-200 bg-white p-5">
          <p className="whitespace-pre-line text-base leading-8 text-zinc-700">
            {toNumberedBlock(project.outcomes)}
          </p>
        </div>
      </Section>

      {project.futureImprovements && project.futureImprovements.length > 0 && (
        <Section title="后续优化方向">
          <div className="glass-panel rounded-xl border border-zinc-200 bg-white p-5">
            <p className="whitespace-pre-line text-base leading-8 text-zinc-700">
              {toNumberedBlock(project.futureImprovements)}
            </p>
          </div>
        </Section>
      )}
    </div>
  );
}





