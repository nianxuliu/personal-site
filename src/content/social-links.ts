import { siteConfig } from "@/content/site";

export type SocialLink = {
  label: string;
  href: string;
  value: string;
};

export const socialLinks: SocialLink[] = [
  {
    label: "GitHub",
    href: `https://github.com/${siteConfig.githubUsername}`,
    value: `@${siteConfig.githubUsername}`,
  },
  {
    label: "项目仓库",
    href: `https://github.com/${siteConfig.githubUsername}?tab=repositories`,
    value: `github.com/${siteConfig.githubUsername}`,
  },
];
