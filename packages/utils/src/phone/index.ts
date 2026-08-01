import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
} from "libphonenumber-js/min";
import type { CountryCode } from "libphonenumber-js/min";

export { AsYouType, getCountries, getCountryCallingCode };
export type { CountryCode };

export function isValidPhone(value: string): boolean {
  return isValidPhoneNumber(value);
}

/**
 * Normalizes user input to the E.164 form stored in `User.phone`. Returns null
 * rather than throwing so callers can surface a field error instead of a crash.
 */
export function toE164(input: string, country?: CountryCode): string | null {
  const parsed = parsePhoneNumberFromString(input, country);
  return parsed?.isValid() ? parsed.number : null;
}

export function formatAsYouType(input: string, country: CountryCode): string {
  return new AsYouType(country).input(input);
}
