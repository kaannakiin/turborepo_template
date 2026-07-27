// Typed-keys augmentation must ship with this entry: its d.ts carries the
// `declare module "i18next"` block consumers rely on for key completion.
import "./types";

export { createI18nInstance } from "./create-i18n";
export { resources } from "./resources";
export { getTranslator, type TranslateFn } from "./translator";
