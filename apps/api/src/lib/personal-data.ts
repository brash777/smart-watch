/*
 * Emails and phone numbers never reach the AI (docs/PRODUCT.md, "AI rules"). Every text an
 * AI task sends goes through removeContactDetails(), and the AI runner applies it once more to
 * the whole prompt.
 */

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu;

/** Digits that may be grouped with spaces, dots, dashes or parentheses, maybe after a +. */
const DIGIT_RUN = /(?<![\p{L}\p{N}])\+?\d[\d ().-]*\d(?![\p{L}\p{N}])/gu;

/**
 * The shortest phone numbers (local numbers without area code) have 7 digits. Longer runs of
 * digits are removed too: an ID or an account number is personal data as well.
 */
const PHONE_MIN_DIGITS = 7;

/** Dates have enough digits to look like phone numbers, so they are kept. */
const DATES = [/^\d{4}-\d{2}-\d{2}$/, /^\d{2}[.-]\d{2}[.-]\d{4}$/];

export const EMAIL_PLACEHOLDER = '[email]';
export const PHONE_PLACEHOLDER = '[phone]';

function isPhoneNumber(candidate: string): boolean {
  const digits = candidate.replace(/\D/g, '').length;
  return digits >= PHONE_MIN_DIGITS && !DATES.some((date) => date.test(candidate));
}

/** The text without email addresses and phone numbers, replaced by [email] and [phone]. */
export function removeContactDetails(text: string): string {
  return text
    .replace(EMAIL, EMAIL_PLACEHOLDER)
    .replace(DIGIT_RUN, (match) => (isPhoneNumber(match) ? PHONE_PLACEHOLDER : match));
}
