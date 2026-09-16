import { randomBytes } from 'node:crypto';

export function generateToken(bytes = 16) {
  return randomBytes(bytes).toString('hex');
}
