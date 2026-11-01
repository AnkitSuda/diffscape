import { describe, expect, it } from "vitest";
import { aggregateCounts, samePathGroups } from "./contracts";
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
});
