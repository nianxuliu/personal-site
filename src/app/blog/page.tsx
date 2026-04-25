import type { Metadata } from "next";

import { BlogPostCard } from "@/components/cards/blog-post-card";
import { Section } from "@/components/ui/section";
import { blogPosts } from "@/content/blog";

export const metadata: Metadata = {
  title: "博客",
  description: "围绕真实项目实现的技术文章，包含方案拆解与代码实现要点。",
};

export default function BlogPage() {
  return (
    <Section
      title="博客"
      description="以下文章基于真实项目文档整理，聚焦设计思路、关键流程与代码实现细节。"
      headingLevel={1}
    >
      <div className="grid gap-5">
        {blogPosts.map((post) => (
          <BlogPostCard key={post.slug} post={post} />
        ))}
      </div>
    </Section>
  );
}





