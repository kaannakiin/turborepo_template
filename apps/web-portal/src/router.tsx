import { createI18nInstance } from "@repo/i18n/instance";
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { initReactI18next } from "react-i18next";
import { getRequestLocale } from "./i18n/locale";
import { bindZodLocale } from "./i18n/zod";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  // Start calls getRouter() per request on the server (inside its request
  // context, so the cookie is readable here) and exactly once on the client.
  // Each SSR request therefore gets its own i18next instance — concurrent
  // requests in different languages never share state.
  const locale = getRequestLocale();
  const i18n = createI18nInstance(locale, [initReactI18next]);
  bindZodLocale(i18n);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // SSR: refetching immediately on the client after hydration wastes the
        // dehydrated cache. 60s covers the hydration window.
        staleTime: 60_000,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient, locale, i18n },
    scrollRestoration: true,
    defaultPreload: "intent",
  });

  // Dehydrates the query cache on the server and hydrates it on the client.
  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
