import { invoke, isTauri } from "@tauri-apps/api/core";
import type { DiffMode, DiffResponse, RepositorySnapshot } from "./contracts";

const demoPreviewEnabled =
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get("preview") === "demo";

export const gitApi = {
  open: (path: string, comparisonBase: string | null) =>
    invoke<RepositorySnapshot>("open_repository", { path, comparisonBase }),
  refresh: (path: string, comparisonBase: string | null) =>
    invoke<RepositorySnapshot>("refresh_repository", { path, comparisonBase }),
  diff: (
    worktreePath: string,
    worktreeId: string,
    path: string,
    oldPath: string | null,
    mode: DiffMode,
    base: string | null,
  ) => {
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
    });
  },
  watch: (path: string, comparisonBase: string | null) =>
    invoke<void>("watch_repository", { path, comparisonBase }),
  stop: (path: string) => invoke<void>("stop_watch", { path }),
  reveal: (path: string) => invoke<void>("reveal_path", { path }),
};

export const isNative = isTauri();
