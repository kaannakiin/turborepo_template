import type { SupportedLocale } from '@repo/i18n/locale';

declare global {
  namespace Express {
    interface Request {
      /** Set for every request by the Accept-Language middleware in main.ts. */
      locale?: SupportedLocale;
    }
  }
}

export {};
