export type FileStatus =
  "modified" | "added" | "deleted" | "renamed" | "untracked" | "unmerged" | string;

export interface WorktreeFile {
  id: string;
  path: string;
  oldPath: string | null;
  status: FileStatus;
  staged: boolean;
  unstaged: boolean;
  untracked: boolean;
  committed: boolean;
}

export interface Worktree {
  id: string;
  path: string;
  branch: string | null;
  head: string;
  detached: boolean;
  isMain: boolean;
  base: string | null;
  baseError: string | null;
  files: WorktreeFile[];
  uniquePaths: number;
  worktreeFileChanges: number;
  stagedCount: number;
  unstagedCount: number;
  untrackedCount: number;
  committedCount: number;
}

export interface RepositorySnapshot {
  root: string;
  worktrees: Worktree[];
  scannedAt: number;
}

export interface DiffResponse {
  worktreeId: string;
  path: string;
  oldPath: string | null;
  content: string;
  truncated: boolean;
  binary: boolean;
  tooLarge: boolean;
}

export type DiffMode = "working" | "staged" | "total";
export type Language = "en" | "hi";

export const samePathGroups = (worktrees: Worktree[]) => {
  const groups = new Map<string, Array<{ worktree: Worktree; file: WorktreeFile }>>();
  for (const worktree of worktrees) {
    for (const file of worktree.files) {
      const entries = groups.get(file.path) ?? [];
      entries.push({ worktree, file });
      groups.set(file.path, entries);
    }
  }
  return [...groups.entries()].map(([path, entries]) => ({ path, entries }));
};

export const aggregateCounts = (worktrees: Worktree[]) => ({
  uniquePaths: new Set(
    worktrees.flatMap(worktree => worktree.files.map(file => file.path)).values(),
  ).size,
  worktreeFileChanges: worktrees.reduce(
    (total, worktree) => total + worktree.worktreeFileChanges,
    0,
  ),
  staged: worktrees.reduce((total, worktree) => total + worktree.stagedCount, 0),
  unstaged: worktrees.reduce((total, worktree) => total + worktree.unstagedCount, 0),
  untracked: worktrees.reduce((total, worktree) => total + worktree.untrackedCount, 0),
  committed: worktrees.reduce((total, worktree) => total + worktree.committedCount, 0),
});
