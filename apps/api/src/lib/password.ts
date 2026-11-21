import bcrypt from 'bcryptjs';

/** Hashes a password with bcrypt. `rounds` is the cost factor (BCRYPT_ROUNDS). */
export function hashPassword(password: string, rounds: number): Promise<string> {
  return bcrypt.hash(password, rounds);
}
