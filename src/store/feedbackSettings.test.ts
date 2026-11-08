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

import { FEEDBACK_STORAGE_KEY } from '@/src/feedback/settings';
import { useFeedbackSettings } from '@/src/store/feedbackSettings';

describe('feedback settings persistence', () => {
  beforeEach(async () => {
    memory.clear();
    useFeedbackSettings.setState({ sound: true, haptics: true });
    await flush();
  });

  it('defaults to sound on and haptics on', () => {
    expect(useFeedbackSettings.getState().sound).toBe(true);
    expect(useFeedbackSettings.getState().haptics).toBe(true);
  });

  it('writes each toggle and restores it on the next load', async () => {
    useFeedbackSettings.getState().setSound(false);
    useFeedbackSettings.getState().setHaptics(false);
    await flush();

    const raw = await AsyncStorage.getItem(FEEDBACK_STORAGE_KEY);
    expect(JSON.parse(raw ?? '{}')).toMatchObject({ state: { sound: false, haptics: false } });

    await AsyncStorage.setItem(
      FEEDBACK_STORAGE_KEY,
      JSON.stringify({ state: { sound: true, haptics: false }, version: 0 }),
    );
    await useFeedbackSettings.persist.rehydrate();
    expect(useFeedbackSettings.getState().sound).toBe(true);
    expect(useFeedbackSettings.getState().haptics).toBe(false);
  });

  it('keeps the current toggles when the stored value is not a pair of booleans', async () => {
    useFeedbackSettings.getState().setSound(false);
    await flush();

    await AsyncStorage.setItem(
      FEEDBACK_STORAGE_KEY,
      JSON.stringify({ state: { sound: 'loud', haptics: 1 }, version: 0 }),
    );
    await useFeedbackSettings.persist.rehydrate();
    expect(useFeedbackSettings.getState().sound).toBe(false);
    expect(useFeedbackSettings.getState().haptics).toBe(true);
  });

  it('does not share a storage key with progress', () => {
    expect(FEEDBACK_STORAGE_KEY).not.toBe('jdb-progress-v1');
    expect(FEEDBACK_STORAGE_KEY).not.toBe('jdb-theme-v1');
  });
});

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}
