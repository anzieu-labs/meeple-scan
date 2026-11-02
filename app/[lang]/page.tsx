import type { Metadata } from "next";

import { Landing } from "@/components/landing/landing";
import { ScanScreen } from "@/components/scanner/scan-screen";
import { JsonLd } from "@/components/seo/json-ld";
import { hasLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { pageMetadata, SITE } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const { meta } = getDictionary(lang);
  return pageMetadata({ locale: lang, title: meta.title, description: meta.description, path: "/", home: true });
}

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  const { meta } = getDictionary(hasLocale(lang) ? lang : "en");
  return (
    <>
      {/* Tells search engines what the page is: a free web app, and what it does. */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: SITE.name,
          url: SITE.url,
          inLanguage: lang,
          description: meta.description,
          applicationCategory: "GameApplication",
          operatingSystem: "Any (web browser with a camera)",
          browserRequirements: "Requires a camera and JavaScript",
          featureList: meta.features,
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }}
      />
      {/* On a computer, the landing page. */}
      <Landing locale={hasLocale(lang) ? lang : "en"} />
      {/* On a phone the camera fills the screen: the title, pitch and features are for screen readers and search
          engines (in the HTML before the app loads). */}
      <div className="sr-only lg:hidden">
        <h1>{meta.title}</h1>
        <p>{meta.description}</p>
        <ul>
          {meta.features.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      </div>
      <ScanScreen />
    </>
  );
}
