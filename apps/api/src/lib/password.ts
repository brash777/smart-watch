import bcrypt from 'bcryptjs';

/** Hashes a password with bcrypt. `rounds` is the cost factor (BCRYPT_ROUNDS). */
export function hashPassword(password: string, rounds: number): Promise<string> {
  return bcrypt.hash(password, rounds);
}

/** True when the password matches the bcrypt hash. */
export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}
