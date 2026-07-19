import { Authorization, Token, UserInfo } from '@/constants/authorization';
import { getSearchValue } from './common-util';
const KeySet = [Authorization, Token, UserInfo];
const AdminAuthorization = 'adminAuthorization';
const AdminToken = 'adminToken';
const AdminUserInfo = 'adminUserInfo';
const AdminViewSession = 'adminViewSession';
const AdminKeySet = [AdminAuthorization, AdminToken, AdminUserInfo];

const storage = {
  getAuthorization: () => {
    return localStorage.getItem(Authorization);
  },
  getToken: () => {
    return localStorage.getItem(Token);
  },
  getUserInfo: () => {
    return localStorage.getItem(UserInfo);
  },
  getUserInfoObject: () => {
    const userInfoStr = localStorage.getItem(UserInfo);
    return userInfoStr ? JSON.parse(userInfoStr) : null;
  },
  setAuthorization: (value: string) => {
    localStorage.setItem(Authorization, value);
  },
  setToken: (value: string) => {
    localStorage.setItem(Token, value);
  },
  setUserInfo: (value: string | Record<string, unknown>) => {
    const valueStr = typeof value !== 'string' ? JSON.stringify(value) : value;
    localStorage.setItem(UserInfo, valueStr);
  },
  setItems: (pairs: Record<string, string>) => {
    Object.entries(pairs).forEach(([key, value]) => {
      localStorage.setItem(key, value);
    });
  },
  removeAuthorization: () => {
    localStorage.removeItem(Authorization);
  },
  clearAdminViewSession: () => {
    sessionStorage.removeItem(AdminViewSession);
  },
  removeAll: () => {
    KeySet.forEach((x) => {
      localStorage.removeItem(x);
    });
    sessionStorage.removeItem(AdminViewSession);
  },
  setLanguage: (lng: string) => {
    localStorage.setItem('lng', lng);
  },
  getLanguage: (): string => {
    return localStorage.getItem('lng') as string;
  },
};

export const getAuthorization = () => {
  const auth = getSearchValue('auth');
  const requestedAdminView = getSearchValue('admin_view') === '1';
  if (auth) {
    storage.clearAdminViewSession();
  } else if (requestedAdminView) {
    sessionStorage.setItem(AdminViewSession, '1');
  }
  const useAdminAuthorization =
    requestedAdminView || sessionStorage.getItem(AdminViewSession) === '1';
  const authorization = auth
    ? 'Bearer ' + auth
    : useAdminAuthorization
      ? localStorage.getItem(AdminAuthorization) || ''
      : storage.getAuthorization() || '';

  return authorization;
};

export default storage;

export const adminAuthorizationUtil = {
  getAuthorization: () => localStorage.getItem(AdminAuthorization),
  getToken: () => localStorage.getItem(AdminToken),
  getUserInfoObject: () => {
    const userInfo = localStorage.getItem(AdminUserInfo);
    return userInfo ? JSON.parse(userInfo) : null;
  },
  setItems: ({
    Authorization: authorization,
    Token: token,
    userInfo,
  }: Record<string, string>) => {
    localStorage.setItem(AdminAuthorization, authorization);
    localStorage.setItem(AdminToken, token);
    localStorage.setItem(AdminUserInfo, userInfo);
  },
  removeAll: () => {
    AdminKeySet.forEach((key) => localStorage.removeItem(key));
    sessionStorage.removeItem(AdminViewSession);
  },
};

export const getAdminAuthorization = () =>
  adminAuthorizationUtil.getAuthorization() || '';

// Will not jump to the login page
export function redirectToLogin() {
  // const env = import.meta.env;
  window.location.href = location.origin + `/login`;
}
