import { NextRequest } from "next/server";

import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

// Create the next-intl middleware with custom locale detection
const intlMiddleware = createMiddleware({
  ...routing,
  localeDetection: true, // Enable automatic locale detection
});

export default function middleware(request: NextRequest) {
  // Get saved locale from cookie
  const savedLocale = request.cookies.get("locale")?.value;

  // If there's a saved locale and it's supported, use it as default
  if (savedLocale && routing.locales.includes(savedLocale)) {
    // Check if the current path doesn't already have a locale
    const pathname = request.nextUrl.pathname;
    const hasLocale = routing.locales.some((locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`);

    // If no locale in path and we have a saved preference, redirect
    if (!hasLocale && pathname !== "/") {
      const url = request.nextUrl.clone();
      url.pathname = `/${savedLocale}${pathname}`;
      return Response.redirect(url);
    }
  }

  // Use the default next-intl middleware
  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"], // Match all paths except API routes and static files
  // This matcher can be adjusted based on your routing needs
  // For example, you can exclude specific paths or patterns
};
