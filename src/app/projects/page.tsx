import type { Metadata } from "next";

import { ProjectCard } from "@/components/cards/project-card";
import { Section } from "@/components/ui/section";
import { projects } from "@/content/projects";

export const metadata: Metadata = {
  title: "项目",
  description: "项目列表与技术栈展示。",
};

export default function ProjectsPage() {
  return (
    <Section
      title="项目"
      description="基于本地文档整理的项目档案，支持查看每个项目的完整技术细节。"
      headingLevel={1}
    >
      <div className="grid gap-5">
        {projects.map((project) => (
          <ProjectCard key={project.slug} project={project} />
        ))}
      </div>
    </Section>
  );
}





