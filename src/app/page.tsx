import { Section } from "@/components/ui/section";
import { siteConfig } from "@/content/site";

export default function Home() {
  return (
    <div className="space-y-14">
      <Section
        className="space-y-7"
        eyebrow="Full-Stack Engineer"
        title={`你好，我是${siteConfig.name}`}
        description={siteConfig.introduction}
        headingLevel={1}
      />
    </div>
  );
}




