import { i18next } from '../i18n';

/*
 * Dates and numbers in the language of the app, with Intl. The API sends ISO 8601 dates.
 */

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(i18next.language, { dateStyle: 'medium' }).format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat(i18next.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

export function formatPercent(fraction: number): string {
  return new Intl.NumberFormat(i18next.language, { style: 'percent' }).format(fraction);
}
