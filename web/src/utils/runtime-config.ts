import defaultConfig from '@/conf.json';

export interface AppRuntimeConfig {
  appName: string;
  appIconUrl: string;
}

let runtimeConfig: AppRuntimeConfig = {
  appName: defaultConfig.appName,
  appIconUrl: defaultConfig.appIconUrl,
};

const normalizeConfig = (value: unknown): AppRuntimeConfig => {
  const appName =
    typeof value === 'object' &&
    value !== null &&
    'appName' in value &&
    typeof value.appName === 'string'
      ? value.appName.trim()
      : '';
  const appIconUrl =
    typeof value === 'object' &&
    value !== null &&
    'appIconUrl' in value &&
    typeof value.appIconUrl === 'string'
      ? value.appIconUrl.trim()
      : '';

  return {
    appName: appName || defaultConfig.appName,
    appIconUrl: appIconUrl || defaultConfig.appIconUrl,
  };
};

const updateFavicon = (appIconUrl: string) => {
  let favicon = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (!favicon) {
    favicon = document.createElement('link');
    favicon.rel = 'icon';
    document.head.appendChild(favicon);
  }
  favicon.removeAttribute('type');
  favicon.href = appIconUrl;
};

export const loadRuntimeConfig = async (): Promise<AppRuntimeConfig> => {
  try {
    const response = await fetch('/conf.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    runtimeConfig = normalizeConfig(await response.json());
  } catch (error) {
    console.warn(
      'Failed to load runtime configuration, using defaults.',
      error,
    );
  }

  document.title = runtimeConfig.appName;
  updateFavicon(runtimeConfig.appIconUrl);
  return runtimeConfig;
};

export const getRuntimeConfig = (): AppRuntimeConfig => runtimeConfig;
