import defaultConfig from '@/conf.json';

export interface AppRuntimeConfig {
  appName: string;
}

let runtimeConfig: AppRuntimeConfig = {
  appName: defaultConfig.appName,
};

const normalizeConfig = (value: unknown): AppRuntimeConfig => {
  const appName =
    typeof value === 'object' &&
    value !== null &&
    'appName' in value &&
    typeof value.appName === 'string'
      ? value.appName.trim()
      : '';

  return { appName: appName || defaultConfig.appName };
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
  return runtimeConfig;
};

export const getRuntimeConfig = (): AppRuntimeConfig => runtimeConfig;
