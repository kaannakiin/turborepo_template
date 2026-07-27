import enCommon from "./en/common.json";
import enErrors from "./en/errors.json";
import enValidation from "./en/validation.json";
import trCommon from "./tr/common.json";
import trErrors from "./tr/errors.json";
import trValidation from "./tr/validation.json";

export const resources = {
  tr: { common: trCommon, validation: trValidation, errors: trErrors },
  en: { common: enCommon, validation: enValidation, errors: enErrors },
} as const;
