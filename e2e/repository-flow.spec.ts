import { expect, test } from "@playwright/test";
import type { ActivityEvent, RepositorySnapshot } from "../src/lib/contracts";

const alpha = "/e2e/repos/alpha";
const beta = "/e2e/repos/beta";

test.beforeEach(async ({ page }) => {
  await page.goto("/?e2e=1");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("opens and switches registered repositories with linked worktrees", async ({
  page,
}) => {
  await page.evaluate(path => window.__DIFFSCAPE_E2E__?.setNextRepository(path), alpha);
  await page.getByRole("button", { name: "Open repository" }).click();
  await expect(page.getByText(alpha, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /main Main worktree/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /feature\/e2e/ })).toBeVisible();

  await page.evaluate(path => window.__DIFFSCAPE_E2E__?.setNextRepository(path), beta);
  await page.getByRole("button", { name: "Open repository" }).click();
  await expect(page.getByText(beta, { exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Repositories" })).toHaveValue(beta);
  await page.getByRole("combobox", { name: "Repositories" }).selectOption(alpha);
  await expect(page.getByText(alpha, { exact: true })).toBeVisible();
});

test("selects an individual duplicate-path worktree diff and updates the observed activity timeline", async ({
  page,
}) => {
  await page.evaluate(path => window.__DIFFSCAPE_E2E__?.setNextRepository(path), alpha);
  await page.getByRole("button", { name: "Open repository" }).click();
  const selected = page
    .locator(".file-row")
    .filter({ hasText: "feature/e2e" })
    .filter({ hasText: "Navigation.tsx" });
  await selected.click();
  await expect(page.locator(".diff-content")).toContainText(`worktree ${alpha}-linked`);

  const snapshot = await page.evaluate(() =>
    window.__DIFFSCAPE_E2E__!.snapshot("/e2e/repos/alpha"),
  );
  const event: ActivityEvent = {
    id: "activity-e2e-1",
    repositoryRoot: alpha,
    observedAt: Date.now(),
    worktreeId: snapshot.worktrees[1]!.id,
    worktreeLabel: "feature/e2e",
    kind: "filesystem",
    paths: ["src/live-update.ts"],
  };
  const next: RepositorySnapshot = {
    ...snapshot,
    scannedAt: Date.now() + 1,
    activityEvents: [event],
    worktrees: snapshot.worktrees.map((worktree, index) =>
      index === 1
        ? {
            ...worktree,
            files: [
              ...worktree.files,
              {
                id: `${worktree.id}::src/live-update.ts`,
                path: "src/live-update.ts",
                oldPath: null,
                status: "untracked",
                staged: false,
                unstaged: false,
                untracked: true,
                committed: false,
              },
            ],
            worktreeFileChanges: worktree.worktreeFileChanges + 1,
            uniquePaths: worktree.uniquePaths + 1,
            untrackedCount: worktree.untrackedCount + 1,
          }
        : worktree,
    ),
  };
  await page.evaluate(value => window.__DIFFSCAPE_E2E__?.emit(value), next);
  await expect(page.getByRole("treeitem", { name: /live-update\.ts/ })).toBeVisible();
  await page.getByRole("button", { name: "Activity observed this session" }).click();
  await expect(page.getByRole("log").getByText("src/live-update.ts")).toBeVisible();
});

test("filters, grouping, file sorting and diff context preferences are interactive", async ({
  page,
}) => {
  await page.evaluate(path => window.__DIFFSCAPE_E2E__?.setNextRepository(path), alpha);
  await page.getByRole("button", { name: "Open repository" }).click();
  await page.getByRole("combobox", { name: "Group changes" }).selectOption("worktree");
  await expect(page.getByRole("treeitem", { name: "main 2" })).toBeVisible();
  await page.getByRole("combobox", { name: "Sort changes" }).selectOption("status");
  await page.getByRole("combobox", { name: "All statuses" }).selectOption("renamed");
  await expect(
    page.getByRole("treeitem", { name: /Navigation\.tsx/ }).first(),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "All statuses" }).selectOption("all");
  await page.getByRole("combobox", { name: "Group changes" }).selectOption("path");
  await page.getByRole("treeitem", { name: /Navigation\.tsx 2 worktrees/ }).click();
  await page.getByRole("combobox", { name: "Context lines" }).selectOption("10");
  await expect(page.getByText(/context 10/)).toBeVisible();
  await page.getByRole("button", { name: "Language" }).click();
  await expect(page.getByRole("combobox", { name: "बदलाव समूह" })).toBeVisible();
});

test("accepts a dropped repository path in the browser development harness", async ({
  page,
}) => {
  await page.evaluate(path => window.__DIFFSCAPE_E2E__?.setNextRepository(path), beta);
  await page.getByTestId("app-shell").drop({ data: { "text/plain": beta } });
  await expect(page.getByText(beta, { exact: true })).toBeVisible();
});

test("preferences and the timeline remain usable in a compact window", async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 560 });
  await page.evaluate(path => window.__DIFFSCAPE_E2E__?.setNextRepository(path), alpha);
  await page.getByRole("button", { name: "Open repository" }).click();
  await page.locator(".settings-menu > summary").click();
  const editor = page.getByRole("textbox", { name: "External editor application" });
  await editor.fill("Visual Studio Code.app");
  await expect(editor).toHaveValue("Visual Studio Code.app");
  await page.getByRole("button", { name: "Activity observed this session" }).click();
  await expect(page.getByRole("log")).toContainText(
    "No activity observed during this session.",
  );
  await expect(page.getByRole("region", { name: "CHANGES" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Diff viewer" })).toBeVisible();
});
