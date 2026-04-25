import { Container } from "@/components/ui/container";
import { LinkButton } from "@/components/ui/link-button";
import { socialLinks } from "@/content/social-links";

const currentYear = new Date().getFullYear();

export function SiteFooter() {
  return (
    <footer className="border-t border-zinc-200/80 bg-white/70">
      <Container className="flex flex-col gap-4 py-8 text-sm text-zinc-600 md:flex-row md:items-center md:justify-between">
        <p>© {currentYear} 刘栩年. All rights reserved.</p>
        <ul className="flex flex-wrap items-center gap-4">
          {socialLinks.map((link) => (
            <li key={link.label}>
              <LinkButton
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5"
              >
                {link.label}
              </LinkButton>
            </li>
          ))}
        </ul>
      </Container>
    </footer>
  );
}




