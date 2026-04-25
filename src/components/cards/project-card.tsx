import { LinkButton } from "@/components/ui/link-button";
import { SharedLayout } from "@/components/ui/shared-layout";
import type { Project } from "@/content/projects";

type ProjectCardProps = {
  project: Project;
};

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <article className="glass-panel flex h-full flex-col rounded-xl border border-zinc-200 bg-white p-6">
      <SharedLayout layoutId={`project-meta-${project.slug}`}>
        <p className="text-xs text-zinc-500">
          {project.period} · {project.role}
        </p>
      </SharedLayout>

      <SharedLayout layoutId={`project-title-${project.slug}`} className="mt-1">
        <h3 className="text-xl font-semibold tracking-tight text-zinc-900">{project.name}</h3>
      </SharedLayout>

      <SharedLayout layoutId={`project-summary-${project.slug}`} className="mt-3 flex-1">
        <p className="text-base leading-8 text-zinc-600">{project.summary}</p>
      </SharedLayout>

      <ul className="mt-4 flex flex-wrap gap-2">
        {project.techStack.map((tech) => (
          <li
            key={`${project.slug}-${tech}`}
            className="glass-chip inline-flex items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-600"
          >
            {tech}
          </li>
        ))}
      </ul>

      <div className="mt-5 flex items-center gap-3">
        <LinkButton href={`/projects/${project.slug}`} className="w-fit">
          查看项目详情
        </LinkButton>
        {project.repoUrl && (
          <LinkButton
            href={project.repoUrl}
            target="_blank"
            rel="noreferrer"
            className="w-fit"
          >
            仓库
          </LinkButton>
        )}
      </div>
    </article>
  );
}
