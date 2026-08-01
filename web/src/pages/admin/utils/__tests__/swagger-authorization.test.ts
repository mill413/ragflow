import { authorizeSwaggerSession } from '../swagger-authorization';

describe('authorizeSwaggerSession', () => {
  it('registers the current bearer token in Swagger authorization state', () => {
    const authorize = jest.fn();

    expect(
      authorizeSwaggerSession(
        { authActions: { authorize } },
        'adminBearer',
        'Bearer session-token',
      ),
    ).toBe(true);
    expect(authorize).toHaveBeenCalledWith({
      adminBearer: {
        name: 'adminBearer',
        schema: { type: 'http', scheme: 'bearer' },
        value: 'session-token',
      },
    });
  });

  it('does not authorize Swagger without a current session', () => {
    const authorize = jest.fn();

    expect(
      authorizeSwaggerSession({ authActions: { authorize } }, 'BearerAuth', ''),
    ).toBe(false);
    expect(authorize).not.toHaveBeenCalled();
  });
});
