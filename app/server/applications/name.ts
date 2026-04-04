export const APPLICATION_NAME_SEPARATOR = '_neupappify_';
export const APPLICATION_NAME_SUFFIX_LENGTH = 8;

export function normalizeApplicationNameInput(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 64);
}

export function generateApplicationNameSuffix() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let suffix = '';

  for (let index = 0; index < APPLICATION_NAME_SUFFIX_LENGTH; index += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return suffix;
}

export function generateApplicationName(baseName: string, suffix?: string) {
  const normalizedBaseName = normalizeApplicationNameInput(baseName);
  const finalSuffix = suffix || generateApplicationNameSuffix();

  return `${normalizedBaseName}${APPLICATION_NAME_SEPARATOR}${finalSuffix}`;
}