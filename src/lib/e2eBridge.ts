import type { ActivityEvent, RepositorySnapshot } from "./contracts";
import { demoSnapshot } from "./demo";

export const E2E_REPO_A = "/e2e/repos/alpha";
export const E2E_REPO_B = "/e2e/repos/beta";
export const isE2eMode =
  import.meta.env.DEV && new URLSearchParams(window.location.search).has("e2e");

const makeSnapshot = (root: string, scannedAt = Date.now()): RepositorySnapshot => {
  const snapshot = structuredClone(demoSnapshot);
  snapshot.root = root;
  snapshot.scannedAt = scannedAt;
  snapshot.activityEvents = [];
  snapshot.worktrees = snapshot.worktrees.map((worktree, index) => {
    const path = index === 0 ? root : `${root}-linked`;
    return {
      ...worktree,
      id: path,
      path,
      branch: index === 0 ? (root === E2E_REPO_B ? "develop" : "main") : "feature/e2e",
      files: worktree.files.map(file => ({ ...file, id: `${path}::${file.path}` })),
    };
  });
  return snapshot;
};

let nextRepository = E2E_REPO_A;
const listeners = new Set<(snapshot: RepositorySnapshot) => void>();

export const takeNextE2eRepository = () => {
  const next = nextRepository;
  nextRepository = E2E_REPO_A;
  return next;
};

export const getE2eSnapshot = (root: string) => makeSnapshot(root);
export const subscribeE2e = (callback: (snapshot: RepositorySnapshot) => void) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};

export const emitE2eSnapshot = (snapshot: RepositorySnapshot) => {
  for (const listener of listeners) listener(snapshot);
};

if (isE2eMode) {
  Object.assign(window, {
    __DIFFSCAPE_E2E__: {
      setNextRepository(path: string) {
        nextRepository = path;
      },
      snapshot(path: string) {
        return makeSnapshot(path);
      },
      emit(snapshot: RepositorySnapshot) {
        emitE2eSnapshot(snapshot);
      },
      activityEvent(event: ActivityEvent) {
        return event;
      },
    },
  });
}

declare global {
  interface Window {
    __DIFFSCAPE_E2E__?: {
      setNextRepository(path: string): void;
      snapshot(path: string): RepositorySnapshot;
      emit(snapshot: RepositorySnapshot): void;
      activityEvent(event: ActivityEvent): ActivityEvent;
    };
  }
}
