"use client";

import { useEffect } from "react";

import { useParams, useRouter } from "next/navigation";

import { routing } from "@/i18n/routing";

export function useLocaleRedirect() {
  const params = useParams();
  const router = useRouter();
  const currentLocale = params.locale as string;

  useEffect(() => {
    // Check if we should redirect based on saved preference
    const checkAndRedirect = async () => {
      try {
        // Get saved locale from cookie (client-side)
        const cookies = document.cookie.split(";");
        const localeCookie = cookies.find((cookie) => cookie.trim().startsWith("locale="));

        if (localeCookie) {
          const savedLocale = localeCookie.split("=")[1];

          // If saved locale is different from current and is supported
          if (savedLocale && savedLocale !== currentLocale && routing.locales.includes(savedLocale)) {
            // Redirect to saved locale
            const currentPath = window.location.pathname;
            const newPath = currentPath.replace(`/${currentLocale}`, `/${savedLocale}`);
            router.replace(newPath);
          }
        }
      } catch (error) {
        console.warn("Failed to check locale preference:", error);
      }
    };

    checkAndRedirect();
  }, [currentLocale, router]);
}
