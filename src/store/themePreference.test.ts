import { beforeEach, describe, expect, it, vi } from 'vitest';

const memory = vi.hoisted(() => new Map<string, string>());

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => memory.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: async (key: string) => {
      memory.delete(key);
    },
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';

import { useThemePreference } from '@/src/store/themePreference';
import { THEME_STORAGE_KEY } from '@/src/theme/preference';

describe('theme preference persistence', () => {
  beforeEach(async () => {
    memory.clear();
    useThemePreference.setState({ preference: 'system' });
    await flush();
  });

  it('writes the choice and restores it on the next load', async () => {
    useThemePreference.getState().setPreference('light');
    await flush();

    const raw = await AsyncStorage.getItem(THEME_STORAGE_KEY);
    expect(JSON.parse(raw ?? '{}')).toMatchObject({ state: { preference: 'light' } });

    await AsyncStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ state: { preference: 'dark' }, version: 0 }),
    );
    await useThemePreference.persist.rehydrate();
    expect(useThemePreference.getState().preference).toBe('dark');
  });

  it('keeps the current choice when the stored value is not a theme setting', async () => {
    useThemePreference.getState().setPreference('dark');
    await flush();

    await AsyncStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ state: { preference: 'sepia' }, version: 0 }),
    );
    await useThemePreference.persist.rehydrate();
    expect(useThemePreference.getState().preference).toBe('dark');
  });
});

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}
