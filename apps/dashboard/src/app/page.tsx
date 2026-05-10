import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HeroSection } from "@/components/sections/hero-section";
import { ForWhomSection } from "@/components/sections/for-whom-section";
import { ResearchSection } from "@/components/sections/research-section";
import { HowItWorksSection } from "@/components/sections/how-it-works-section";
import { SafetySection } from "@/components/sections/safety-section";
import { KayoPersonaSection } from "@/components/sections/kayo-persona-section";
import { DashboardPreviewSection } from "@/components/sections/dashboard-preview-section";
import { PricingSection } from "@/components/sections/pricing-section";
import { FaqSection } from "@/components/sections/faq-section";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-cream">
      <SiteHeader />
      <HeroSection />
      <section id="research">
        <ResearchSection />
      </section>
      <section id="for-whom">
        <ForWhomSection />
      </section>
      <section id="how-it-works">
        <HowItWorksSection />
      </section>
      <section id="safety">
        <SafetySection />
      </section>
      <KayoPersonaSection />
      <DashboardPreviewSection />
      <section id="pricing">
        <PricingSection />
      </section>
      <section id="faq">
        <FaqSection />
      </section>
      <SiteFooter />
    </main>
  );
}
