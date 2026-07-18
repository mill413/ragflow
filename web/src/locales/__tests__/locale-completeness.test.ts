import en from '../en';
import zh from '../zh';

interface LocaleObject {
  [key: string]: string | LocaleObject;
}

const flattenKeys = (value: LocaleObject, prefix = ''): string[] =>
  Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === 'string' ? [path] : flattenKeys(child, path);
  });

const hasPath = (value: LocaleObject, path: string) =>
  path.split('.').every((key) => {
    const child = value[key];
    if (child === undefined) return false;
    value = child as LocaleObject;
    return true;
  });

describe('locale completeness', () => {
  it('provides Chinese translations for every flow label', () => {
    const englishKeys = flattenKeys(
      en.translation.flow as unknown as LocaleObject,
    );
    const chineseKeys = new Set(
      flattenKeys(zh.translation.flow as unknown as LocaleObject),
    );

    expect(englishKeys.filter((key) => !chineseKeys.has(key))).toEqual([]);
  });

  it.each([
    'common.description',
    'common.loading',
    'common.searching',
    'common.mcp.namePlaceholder',
    'error_boundary.title',
    'fileManager.dropFilesHere',
    'memory.taskLogDialog.title',
    'message.error',
    'setting.S3CompatibleEndpointUrlTip',
    'skills.renameSpaceTitle',
  ])('defines the active key %s in both locales', (key) => {
    expect(hasPath(en.translation as unknown as LocaleObject, key)).toBe(true);
    expect(hasPath(zh.translation as unknown as LocaleObject, key)).toBe(true);
  });
});
