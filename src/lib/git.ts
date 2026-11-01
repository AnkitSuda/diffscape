import { invoke, isTauri } from "@tauri-apps/api/core";
import type { DiffMode, DiffResponse, RepositorySnapshot } from "./contracts";

export const gitApi = {
  open: (path: string) => invoke<RepositorySnapshot>("open_repository", { path }),
  refresh: (path: string) => invoke<RepositorySnapshot>("refresh_repository", { path }),
  diff: (
    worktreePath: string,
    worktreeId: string,
    path: string,
    oldPath: string | null,
    mode: DiffMode,
    base: string | null,
  ) =>
    invoke<DiffResponse>("get_file_diff", {
      worktreePath,
      worktreeId,
      path,
      oldPath,
      mode,
      base,
    }),
  watch: (path: string) => invoke<void>("watch_repository", { path }),
  stop: (path: string) => invoke<void>("stop_watch", { path }),
  reveal: (path: string) => invoke<void>("reveal_path", { path }),
};

export const isNative = isTauri();
