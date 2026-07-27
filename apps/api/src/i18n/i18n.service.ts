import { Injectable } from '@nestjs/common';
import {
  createI18nInstance,
  getTranslator,
  type TranslateFn,
} from '@repo/i18n/instance';
import { DEFAULT_LOCALE } from '@repo/i18n/locale';
import type { i18n } from 'i18next';

@Injectable()
export class I18nService {
  private readonly instance: i18n = createI18nInstance(DEFAULT_LOCALE);

  translatorFor(locale: string | undefined): TranslateFn {
    return getTranslator(this.instance, locale ?? DEFAULT_LOCALE);
  }
}
