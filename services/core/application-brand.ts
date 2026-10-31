import application from '@base/application.json';

type ApplicationBrandConfig = {
  appName?: unknown;
  appLogo?: {
    favicon?: unknown;
    mainlogo?: unknown;
  } | null;
};

// Resolve optional app branding fields with local assets as safe defaults.
export function getApplicationBranding() {
  const config = application as ApplicationBrandConfig;

  return {
    appName: typeof config.appName === 'string' && config.appName.trim()
      ? config.appName.trim()
      : 'Neup.Cloud',
    favicon: typeof config.appLogo?.favicon === 'string' && config.appLogo.favicon.trim()
      ? config.appLogo.favicon.trim()
      : '/logo.svg',
    mainLogo: typeof config.appLogo?.mainlogo === 'string' && config.appLogo.mainlogo.trim()
      ? config.appLogo.mainlogo.trim()
      : '/logo.svg',
  };
}
