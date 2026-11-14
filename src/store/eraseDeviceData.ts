import { discardPendingProgressWrites, removePersistedProgress } from '@/src/store/progressStorage';
import { PROGRESS_STORAGE_KEY } from '@/src/store/progressMigrate';
import { useProgressStore } from '@/src/store/progress';
import { resetOwnScanForTests } from '@/src/store/ownGames';

/**
 * Erase guest progress on this device.
 * The saved document and any scan cursor still waiting to be written are removed,
 * and the in-memory store returns to a new guest. Theme and sound settings stay.
 * An in-flight username scan is stopped so its cursor cannot be saved again.
 */
export async function eraseDeviceData(): Promise<void> {
  resetOwnScanForTests();
  discardPendingProgressWrites();
  // A storage read that is already in flight must not put the old cursor back.
  useProgressStore.persist.clearStorage();
  useProgressStore.getState().resetProgress();
  await removePersistedProgress(PROGRESS_STORAGE_KEY);
}
