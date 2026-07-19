import { Authorization } from '@/constants/authorization';
import authorizationUtil, {
  getAuthorization,
} from '@/utils/authorization-util';

describe('authorization selection', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('clears inherited admin view state when a target user auth is provided', () => {
    localStorage.setItem('adminAuthorization', 'admin-token');
    localStorage.setItem(Authorization, 'previous-main-token');
    sessionStorage.setItem('adminViewSession', '1');
    window.history.replaceState({}, '', '/?auth=target-user-token');

    expect(getAuthorization()).toBe('Bearer target-user-token');
    expect(sessionStorage.getItem('adminViewSession')).toBeNull();

    authorizationUtil.setAuthorization('target-user-token');
    window.history.replaceState({}, '', '/');
    expect(getAuthorization()).toBe('target-user-token');
  });

  it('continues to use the admin token for explicit admin resource views', () => {
    localStorage.setItem('adminAuthorization', 'admin-token');
    localStorage.setItem(Authorization, 'main-user-token');
    window.history.replaceState({}, '', '/datasets?admin_view=1');

    expect(getAuthorization()).toBe('admin-token');
    expect(sessionStorage.getItem('adminViewSession')).toBe('1');
  });
});
