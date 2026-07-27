import { z } from 'zod';

export const isValidPassword = (password: unknown): password is string =>
  typeof password === 'string' && password.length > 0;

export const passwordRule = (message: string) =>
  z.string().refine(isValidPassword, { message });
