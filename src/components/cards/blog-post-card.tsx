import { LinkButton } from "@/components/ui/link-button";
import { SharedLayout } from "@/components/ui/shared-layout";
import type { BlogPost } from "@/content/blog";

type BlogPostCardProps = {
  post: BlogPost;
};

export function BlogPostCard({ post }: BlogPostCardProps) {
  return (
    <article className="glass-panel rounded-xl border border-zinc-200 bg-white p-6">
      <SharedLayout layoutId={`post-meta-${post.slug}`}>
        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
          <time dateTime={post.date}>{post.date}</time>
          <span>{post.readingTime}</span>
          <span className="glass-chip inline-flex items-center rounded-lg border border-zinc-200 bg-zinc-100 px-2 py-[2px] text-zinc-600">
            {post.status}
          </span>
        </div>
      </SharedLayout>

      <SharedLayout layoutId={`post-title-${post.slug}`} className="mt-3">
        <h3 className="text-xl font-semibold tracking-tight text-zinc-900">{post.title}</h3>
      </SharedLayout>

      <SharedLayout layoutId={`post-excerpt-${post.slug}`} className="mt-2">
        <p className="text-base leading-8 text-zinc-600">{post.excerpt}</p>
      </SharedLayout>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <LinkButton href={`/blog/${post.slug}`} className="w-fit">
          阅读全文
        </LinkButton>
        {post.sourceProject && (
          <LinkButton href={`/projects/${post.sourceProject}`} className="w-fit">
            关联项目
          </LinkButton>
        )}
      </div>
    </article>
  );
}
