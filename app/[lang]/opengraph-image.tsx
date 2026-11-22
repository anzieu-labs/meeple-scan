import { DEFAULT_LOCALE, hasLocale, LOCALES } from "@/lib/i18n/config";
import { SHARE_IMAGE_SIZE, shareImage } from "@/lib/share-image";
import { SITE } from "@/lib/site";

export const alt = SITE.title;
export const size = SHARE_IMAGE_SIZE;
export const contentType = "image/png";

/** One image per language, drawn at build time: link previews never wait for it. */
export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

/** Link preview of every page in a language, at "/fr/opengraph-image" ("/en/opengraph-image" in English). */
export default async function OpengraphImage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return shareImage(hasLocale(lang) ? lang : DEFAULT_LOCALE);
}
