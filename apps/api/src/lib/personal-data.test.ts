import { describe, expect, it } from 'vitest';
import { removeContactDetails } from './personal-data';

describe('removeContactDetails', () => {
  it('removes email addresses', () => {
    expect(removeContactDetails('Escribir a ana.perez+clase@uni.edu.co o a LEO@Example.com.')).toBe(
      'Escribir a [email] o a [email].',
    );
  });

  it('removes phone numbers written in the usual ways', () => {
    const text = 'Llamar al +57 300 123 4567, al (601) 555-1234, al 612.345.678 o al 3001234567.';

    expect(removeContactDetails(text)).toBe(
      'Llamar al [phone], al ([phone], al [phone] o al [phone].',
    );
  });

  it('keeps dates, times, short numbers and the rest of the text', () => {
    const text = 'Parcial 2 del 2024-05-01 (o 01.05.2024) a las 10:30, salón 305, grupo 12-B.';

    expect(removeContactDetails(text)).toBe(text);
  });

  it('removes long runs of digits such as ID numbers', () => {
    expect(removeContactDetails('Cédula 1.020.304.050')).toBe('Cédula [phone]');
  });
});
