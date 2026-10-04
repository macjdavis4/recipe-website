import "server-only";
import bcrypt from "bcrypt";

export const BCRYPT_COST = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

// Hash of a random value nobody knows. Comparing against it when the email has
// no account keeps response times the same, so timing does not reveal accounts.
const DUMMY_HASH = "$2b$12$zdsDKWsvkcmwO0A7/3rqueS4i7XehGeChnw.yx5IB/W9kJbZPhOa6";

export function verifyPassword(
  password: string,
  hash: string | null | undefined,
): Promise<boolean> {
  return bcrypt.compare(password, hash ?? DUMMY_HASH);
}
