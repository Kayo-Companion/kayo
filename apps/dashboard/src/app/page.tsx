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
        "ご両親の認知症対策に特化したAI電話サービス。楽しい会話とことば遊びの中に認知症対策を自然に組み込み、ご家族の早期の気づきをサポートします。",
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "ja-JP",
    },
    {
      "@type": "Service",
      name: "カヨ 認知症対策AI電話サービス",
      serviceType: "高齢者向け認知症対策AI電話サービス",
      provider: { "@id": `${SITE_URL}/#organization` },
      areaServed: { "@type": "Country", name: "Japan" },
      description:
        "ご両親の認知機能の維持を、毎日の習慣に。楽しいことば遊びと会話の中に認知症対策を自然に組み込み、変化があればご家族が一番早く気づけるようサポートします。アプリ不要、電話のみで完結します。",
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
