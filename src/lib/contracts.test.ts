import { describe, expect, it } from "vitest";
import {
  aggregateCounts,
  buildFileTree,
  samePathGroups,
  sortWorktreesByObservedActivity,
} from "./contracts";
import type { Worktree } from "./contracts";

const makeWorktree = (id: string, path: string, fileId: string): Worktree => ({
  id,
  path: `/repo/${id}`,
  branch: id,
  head: "abc123",
  detached: false,
  isMain: id === "main",
  base: "base123",
  baseError: null,
  files: [
    {
      id: fileId,
      path,
      oldPath: null,
      status: "modified",
      staged: true,
      unstaged: true,
      untracked: false,
      committed: true,
    },
  ],
  uniquePaths: 1,
  worktreeFileChanges: 1,
  stagedCount: 1,
  unstagedCount: 1,
  untrackedCount: 0,
  committedCount: 1,
  lastObservedChangeAt: null,
});

describe("cross-worktree aggregation", () => {
  it("groups same relative paths without conflating worktree-file identities", () => {
    const worktrees = [
      makeWorktree("main", "src/shared.ts", "main::src/shared.ts"),
      makeWorktree("feature", "src/shared.ts", "feature::src/shared.ts"),
    ];
    const groups = samePathGroups(worktrees);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.entries.map(entry => entry.file.id)).toEqual([
      "main::src/shared.ts",
      "feature::src/shared.ts",
    ]);
    expect(aggregateCounts(worktrees)).toMatchObject({
      uniquePaths: 1,
      worktreeFileChanges: 2,
      staged: 2,
      unstaged: 2,
      committed: 2,
    });
  });

  it("counts independent paths across worktrees separately", () => {
    expect(
      aggregateCounts([
        makeWorktree("main", "a.ts", "main::a.ts"),
        makeWorktree("feature", "b.ts", "feature::b.ts"),
      ]),
    ).toMatchObject({ uniquePaths: 2, worktreeFileChanges: 2 });
  });

  it("builds expandable directory nodes and keeps duplicate paths as separate worktree entries", () => {
    const main = makeWorktree(
      "main",
      "src/nested/shared.ts",
      "main::src/nested/shared.ts",
    );
    const feature = makeWorktree(
      "feature",
      "src/nested/shared.ts",
      "feature::src/nested/shared.ts",
    );
    const rows = samePathGroups([main, feature]).flatMap(group =>
      group.entries.map(entry => ({ ...entry, shared: group.entries.length > 1 })),
    );
    const tree = buildFileTree(rows);
    expect(tree[0]?.name).toBe("src");
    expect(tree[0]?.children[0]?.name).toBe("nested");
    expect(tree[0]?.children[0]?.children[0]?.entries.map(row => row.file.id)).toEqual([
      "feature::src/nested/shared.ts",
      "main::src/nested/shared.ts",
    ]);
    expect(
      tree[0]?.children[0]?.children[0]?.entries.map(row => row.worktree.branch),
    ).toEqual(["feature", "main"]);
  });

  it("sorts only observed activity newest-first and leaves unobserved worktrees last", () => {
    const old = {
      ...makeWorktree("older", "a.ts", "older::a.ts"),
      lastObservedChangeAt: 100,
    };
    const recent = {
      ...makeWorktree("recent", "b.ts", "recent::b.ts"),
      lastObservedChangeAt: 200,
    };
    const unknown = makeWorktree("unknown", "c.ts", "unknown::c.ts");
    expect(
      sortWorktreesByObservedActivity([old, unknown, recent]).map(
        worktree => worktree.branch,
      ),
    ).toEqual(["recent", "older", "unknown"]);
  });
});
