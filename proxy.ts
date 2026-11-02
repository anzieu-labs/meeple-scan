import { NextResponse, type NextRequest } from "next/server";

import { DEFAULT_LOCALE, hasLocale, LOCALE_COOKIE, localePath } from "@/lib/i18n/config";
import { negotiateLocale } from "@/lib/i18n/negotiate";

/**
 * Picks each page's language. An address with a language ("/fr/rankings") is that language, as is. One
 * without ("/rankings") is English, unless the visitor picked another language (cookie) or, failing that,
 * their browser asks for one we have: then they're sent to it. "/en/…" is only the English pages' internal
 * address, so it's sent back to the one without prefix.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split("/")[1];

  if (first === DEFAULT_LOCALE) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(DEFAULT_LOCALE.length + 1) || "/";
    return NextResponse.redirect(url, 308);
  }
  if (hasLocale(first)) return NextResponse.next();

  const chosen = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = chosen && hasLocale(chosen) ? chosen : negotiateLocale(request.headers.get("accept-language"));
  const url = request.nextUrl.clone();
  if (locale !== DEFAULT_LOCALE) {
    url.pathname = localePath(locale, pathname);
    // Depends on who's asking: never kept by a cache for the next visitor.
    const redirect = NextResponse.redirect(url, 307);
    redirect.headers.set("Cache-Control", "private, no-store");
    redirect.headers.set("Vary", "Accept-Language, Cookie");
    return redirect;
  }
  url.pathname = `/${DEFAULT_LOCALE}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Pages only: not the API, Next's files, files with an extension (robots.txt, manifest, images) or the
  // generated icons and share image.
  matcher: ["/((?!api/|_next/|opengraph-image|apple-icon|icon|pwa-icons/|.*\\.).*)"],
};
