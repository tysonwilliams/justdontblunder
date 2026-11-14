import AsyncStorage from '@react-native-async-storage/async-storage';

/** Separate from jdb-progress-v1 so dismissing the prompt does not change synced progress. */
export const ACCOUNT_PROMPT_KEY = 'jdb-account-prompt-v1';

type PromptStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export async function accountPromptDismissed(storage: PromptStorage = AsyncStorage): Promise<boolean> {
  return (await storage.getItem(ACCOUNT_PROMPT_KEY)) === 'dismissed';
}

export async function dismissAccountPrompt(storage: PromptStorage = AsyncStorage): Promise<void> {
  await storage.setItem(ACCOUNT_PROMPT_KEY, 'dismissed');
}
