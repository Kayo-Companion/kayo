import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HeroSection } from "@/components/sections/hero-section";
import { ForWhomSection } from "@/components/sections/for-whom-section";
import { ResearchSection } from "@/components/sections/research-section";
import { SafetySection } from "@/components/sections/safety-section";
import { KayoPersonaSection } from "@/components/sections/kayo-persona-section";
import { DashboardPreviewSection } from "@/components/sections/dashboard-preview-section";
import { AnyDeviceBand } from "@/components/sections/any-device-band";
import { MultiUserBand } from "@/components/sections/multi-user-band";
import { PricingSection } from "@/components/sections/pricing-section";
import { FaqSection } from "@/components/sections/faq-section";
import { FAQS } from "@/lib/faqs";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "https://kayo.me";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "カヨ",
      url: SITE_URL,
      logo: `${SITE_URL}/logo-mark.png`,
      email: "snakatani0401@gmail.com",
      founder: {
        "@type": "Person",
        name: "中谷マーク駿介",
        jobTitle: "代表者",
      },
      areaServed: "JP",
      inLanguage: "ja",
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "カヨ",
      description:
        "シニア向けAI電話コンパニオン。毎日決まった時間に、優しい話し相手から固定電話または携帯電話へお電話します。",
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "ja-JP",
    },
    {
      "@type": "Service",
      name: "カヨ AI電話コンパニオン",
      serviceType: "AIによるシニア向け電話会話サービス",
      provider: { "@id": `${SITE_URL}/#organization` },
      areaServed: { "@type": "Country", name: "Japan" },
      description:
        "毎日決まった時間に、AIの話し相手「カヨ」から高齢者の固定電話・携帯電話へ自動でお電話します。アプリ不要、スマホ不要。離れて暮らすご家族のための見守りと会話のサービスです。",
      audience: { "@type": "PeopleAudience", suggestedMinAge: 60 },
      offers: [
        {
          "@type": "Offer",
          name: "ライト",
          price: "3980",
          priceCurrency: "JPY",
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: "3980",
            priceCurrency: "JPY",
            unitText: "月額",
          },
          category: "Subscription",
        },
        {
          "@type": "Offer",
          name: "スタンダード",
          price: "9800",
          priceCurrency: "JPY",
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: "9800",
            priceCurrency: "JPY",
            unitText: "月額",
          },
          category: "Subscription",
        },
        {
          "@type": "Offer",
          name: "プレミアム",
          price: "19800",
          priceCurrency: "JPY",
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: "19800",
            priceCurrency: "JPY",
            unitText: "月額",
          },
          category: "Subscription",
        },
      ],
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      mainEntity: FAQS.map((faq) => ({
        "@type": "Question",
        name: faq.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.a,
        },
      })),
    },
  ],
};

export default function HomePage() {
  return (
    <main className="min-h-screen bg-cream">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader />
      <HeroSection />
      <section id="research">
        <ResearchSection />
      </section>
      <section id="for-whom">
        <ForWhomSection />
      </section>
      <section id="safety">
        <SafetySection />
      </section>
      <KayoPersonaSection />
      <DashboardPreviewSection />
      <AnyDeviceBand />
      <MultiUserBand />
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
