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
  lastObservedChangeAt: number | null;
}

export interface RepositorySnapshot {
  root: string;
  availableBases: string[];
  comparisonBase: string | null;
  comparisonBaseOid: string | null;
  comparisonBaseIsManual: boolean;
  comparisonBaseError: string | null;
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

export type TreeEntry = { worktree: Worktree; file: WorktreeFile; shared: boolean };
export type FileTreeNode = {
  name: string;
  path: string;
  children: FileTreeNode[];
  entries: TreeEntry[];
};

export const buildFileTree = (rows: TreeEntry[]): FileTreeNode[] => {
  const roots: FileTreeNode[] = [];
  for (const row of rows) {
    const segments = row.file.path.split("/").filter(Boolean);
    let siblings = roots;
    let currentPath = "";
    segments.forEach((segment, index) => {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      let node = siblings.find(child => child.name === segment);
      if (!node) {
        node = { name: segment, path: currentPath, children: [], entries: [] };
        siblings.push(node);
      }
      if (index === segments.length - 1) node.entries.push(row);
      else siblings = node.children;
    });
  }
  const sort = (nodes: FileTreeNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    for (const node of nodes) {
      node.entries.sort((a, b) => a.worktree.path.localeCompare(b.worktree.path));
      sort(node.children);
    }
  };
  sort(roots);
  return roots;
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

export const sortWorktreesByObservedActivity = (worktrees: Worktree[]) =>
  [...worktrees].sort(
    (a, b) =>
      (b.lastObservedChangeAt ?? -1) - (a.lastObservedChangeAt ?? -1) ||
      a.path.localeCompare(b.path),
  );
