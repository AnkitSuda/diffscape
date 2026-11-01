import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { DiffMode, DiffResponse, RepositorySnapshot } from "./contracts";
import { getE2eSnapshot, isE2eMode, subscribeE2e } from "./e2eBridge";

const demoPreviewEnabled =
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get("preview") === "demo";

export const gitApi = {
  open: (path: string, comparisonBase: string | null) =>
    isE2eMode
      ? Promise.resolve(getE2eSnapshot(path))
      : invoke<RepositorySnapshot>("open_repository", { path, comparisonBase }),
  refresh: (path: string, comparisonBase: string | null) =>
    isE2eMode
      ? Promise.resolve(getE2eSnapshot(path))
      : invoke<RepositorySnapshot>("refresh_repository", { path, comparisonBase }),
  diff: (
    worktreePath: string,
    worktreeId: string,
    path: string,
    oldPath: string | null,
    mode: DiffMode,
    base: string | null,
    contextLines = 3,
  ) => {
    if (isE2eMode) {
      return Promise.resolve<DiffResponse>({
        worktreeId,
        path,
        oldPath,
        content: `diff --git a/${path} b/${path}\n+++ b/${path}\n+worktree ${worktreeId}\n+context ${contextLines}\n`,
        truncated: false,
        binary: false,
        tooLarge: false,
      });
    }
    if (demoPreviewEnabled) {
      return Promise.resolve<DiffResponse>({
        worktreeId,
        path,
        oldPath,
        content:
          'diff --git a/src/components/Navigation.tsx b/src/components/Navigation.tsx\nindex a2d9e7a..d0be53b 100644\n--- a/src/components/Navigation.tsx\n+++ b/src/components/Navigation.tsx\n@@ -18,7 +18,10 @@ export function Navigation() {\n-  return <nav className="old-nav">\n+  return <nav aria-label="Primary" className="site-nav">\n+    <BrandMark />\n+    <NavItems />\n+  </nav>;',
        truncated: false,
        binary: false,
        tooLarge: false,
      });
    }
    return invoke<DiffResponse>("get_file_diff", {
      worktreePath,
      worktreeId,
      path,
      oldPath,
      mode,
      base,
      contextLines,
    });
  },
  watch: (path: string, comparisonBase: string | null) =>
    isE2eMode
      ? Promise.resolve()
      : invoke<void>("watch_repository", { path, comparisonBase }),
  stop: (path: string) =>
    isE2eMode ? Promise.resolve() : invoke<void>("stop_watch", { path }),
  reveal: (path: string) => invoke<void>("reveal_path", { path }),
  editor: (worktreePath: string, path: string, editor: string) =>
    invoke<void>("open_in_editor", { worktreePath, path, editor }),
  listen: (callback: (snapshot: RepositorySnapshot) => void) =>
    isE2eMode
      ? Promise.resolve(subscribeE2e(callback))
      : listen<RepositorySnapshot>("repository-changed", event =>
          callback(event.payload),
        ),
};

export const isNative = isTauri();
