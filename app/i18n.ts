import I18n from 'i18n-js';

const translations = require('./translations.json');
I18n.fallbacks = true;

I18n.translations = translations;

export default function(value: string, variables: any = {}) {
  return I18n.t(value, Object.assign({ defaultValue: value }, variables));
}

export function changeLocale(locale: string) {
  I18n.locale = locale;
}