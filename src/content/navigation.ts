export type NavItem = {
  label: string;
  href: string;
};

export const navItems: NavItem[] = [
  { label: "首页", href: "/" },
  { label: "关于我", href: "/about" },
  { label: "项目", href: "/projects" },
  { label: "博客", href: "/blog" },
  { label: "联系我", href: "/contact" },
];
