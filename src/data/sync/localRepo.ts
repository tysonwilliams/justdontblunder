import type { PersistedProgress } from '@/src/store/progressMigrate';

import type { ProgressRepo, SyncSnapshot } from '@/src/data/sync/types';

/** The current device store. Nothing here talks to a server. */
export function createLocalProgressRepo(io: {
  read: () => PersistedProgress;
  write: (progress: PersistedProgress) => void;
}): ProgressRepo {
  return {
    async load() {
      return io.read();
    },
    async save(progress) {
      io.write(progress);
    },
    async pull() {
      return null;
    },
    async push() {
      return undefined;
    },
    async mergeOnSignIn(guest: SyncSnapshot) {
      return guest.progress;
    },
  };
}
