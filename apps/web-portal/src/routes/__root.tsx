/// <reference types="vite/client" />
import type { ReactNode } from "react";
import type { SupportedLocale } from "@repo/i18n/locale";
import type { QueryClient } from "@tanstack/react-query";
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import type { i18n } from "i18next";
import { I18nextProvider } from "react-i18next";
import appCss from "../styles.css?url";

export interface RouterContext {
  queryClient: QueryClient;
  locale: SupportedLocale;
  i18n: i18n;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: ({ match }) => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: match.context.i18n.t("appTitle") },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  component: Outlet,
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
  const { locale, i18n } = Route.useRouteContext();

  return (
    <html lang={locale}>
      <head>
        <HeadContent />
      </head>
      <body>
        <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
        <Scripts />
      </body>
    </html>
  );
}
