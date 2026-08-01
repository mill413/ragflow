import { getAdminAuthorization } from '@/utils/authorization-util';

export function authorizeSwaggerSession(
  system: any,
  schemeName: string,
  authorization = getAdminAuthorization(),
) {
  const token = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;

  system.authActions.authorize({
    [schemeName]: {
      name: schemeName,
      schema: { type: 'http', scheme: 'bearer' },
      value: token,
    },
  });
  return true;
}
