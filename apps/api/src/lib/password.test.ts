import bcrypt from 'bcryptjs';
import { describe, expect, it } from 'vitest';
import { hashPassword } from './password';

describe('hashPassword', () => {
  it('creates a bcrypt hash with the given cost that only matches the original password', async () => {
    const hash = await hashPassword('correct horse battery', 4);

    expect(hash).toMatch(/^\$2[aby]\$04\$/);
    expect(await bcrypt.compare('correct horse battery', hash)).toBe(true);
    expect(await bcrypt.compare('wrong password', hash)).toBe(false);
  });

  it('salts every hash', async () => {
    const first = await hashPassword('same password', 4);
    const second = await hashPassword('same password', 4);

    expect(first).not.toBe(second);
  });
});
