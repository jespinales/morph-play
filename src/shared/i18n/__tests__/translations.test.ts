import { describe, expect, it } from 'vitest';
import { translations } from '../translations';

describe('i18n translations', () => {
  it('has identical top-level sections and keys in en and es', () => {
    const enSections = Object.keys(translations.en).sort();
    const esSections = Object.keys(translations.es).sort();
    expect(esSections).toEqual(enSections);

    for (const section of enSections as Array<keyof typeof translations.en>) {
      const enKeys = Object.keys(translations.en[section]).sort();
      const esKeys = Object.keys(translations.es[section]).sort();
      expect(esKeys).toEqual(enKeys);
    }
  });

  it('formats dynamic helpers cleanly in both languages', () => {
    expect(translations.en.common.episodeCode(1, 8)).toBe('S1:E8');
    expect(translations.es.common.episodeCode(1, 8)).toBe('T1:E8');
  });
});
