import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import {
  ArrowDown,
  ArrowUp,
  Bell,
  Clock3,
  CircleHelp,
  ExternalLink,
  Command,
  FileCode2,
  FileDiff,
  Folder,
  FolderOpen,
  GitBranch,
  GitFork,
  Languages,
  PanelLeftClose,
  ChevronRight,
  RefreshCw,
  Search,
  Settings2,
  Workflow,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type {
  DiffMode,
  Language,
  RepositorySnapshot,
  Worktree,
  WorktreeFile,
  FileTreeNode,
  TreeEntry,
  ActivityEvent,
  FileSort,
  GroupMode,
} from "./lib/contracts";
import {
  aggregateCounts,
  buildFileTree,
  filterTreeEntries,
  samePathGroups,
  sortWorktreesByObservedActivity,
} from "./lib/contracts";
import { gitApi, isNative } from "./lib/git";
import { translate } from "./lib/i18n";
import { demoSnapshot } from "./lib/demo";
import { isE2eMode, takeNextE2eRepository } from "./lib/e2eBridge";

const demoPreviewEnabled =
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get("preview") === "demo";

const statusClasses: Record<string, string> = {
  modified: "status-modified",
  added: "status-added",
  deleted: "status-deleted",
  renamed: "status-renamed",
  untracked: "status-untracked",
  unmerged: "status-unmerged",
};

const readRepoList = () => {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem("diffscape-repositories") ?? "[]",
    );
    return Array.isArray(parsed)
      ? parsed.filter((path): path is string => typeof path === "string")
      : [];
  } catch {
    return [];
  }
};

export default function App() {
  const [registeredRepos, setRegisteredRepos] = useState<string[]>(readRepoList);
  const [editorApp, setEditorApp] = useState(
    () => localStorage.getItem("diffscape-editor") ?? "",
  );
  const [showTimeline, setShowTimeline] = useState(false);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [groupMode, setGroupMode] = useState<GroupMode>(() =>
    localStorage.getItem("diffscape-group-mode") === "worktree" ? "worktree" : "path",
  );
  const [fileSort, setFileSort] = useState<FileSort>(() => {
    const value = localStorage.getItem("diffscape-file-sort");
    return value === "status" || value === "worktree" || value === "activity"
      ? value
      : "path";
  });
  const [snapshot, setSnapshot] = useState<RepositorySnapshot | null>(() =>
    demoPreviewEnabled ? demoSnapshot : null,
  );
  const [repoError, setRepoError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedWorktree, setSelectedWorktree] = useState<string>("all");
  const [selectedFileId, setSelectedFileId] = useState<string | null>(() =>
    demoPreviewEnabled ? (demoSnapshot.worktrees[0]?.files[0]?.id ?? null) : null,
  );
  const [diffMode, setDiffMode] = useState<DiffMode>("working");
  const [contextLines, setContextLines] = useState(() => {
    const value = Number(localStorage.getItem("diffscape-diff-context"));
    return [0, 1, 3, 5, 10, 20].includes(value) ? value : 3;
  });
  const [commitInput, setCommitInput] = useState("");
  const [worktreeSort, setWorktreeSort] = useState<"branch" | "activity">(() =>
    localStorage.getItem("diffscape-worktree-sort") === "activity"
      ? "activity"
      : "branch",
  );
  const [collapsedDirectories, setCollapsedDirectories] = useState<Set<string>>(
    () => new Set(),
  );
  const [collapsedSharedPaths, setCollapsedSharedPaths] = useState<Set<string>>(
    () => new Set(),
  );
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [listWidth, setListWidth] = useState(320);
  const [diffState, setDiffState] = useState<{
    key: string;
    content: string;
    meta: { binary: boolean; tooLarge: boolean; truncated: boolean } | null;
  } | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState<
    "all" | "staged" | "unstaged" | "untracked" | "committed"
  >("all");
  const [language, setLanguage] = useState<Language>(() =>
    localStorage.getItem("diffscape-language") === "hi" ? "hi" : "en",
  );
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [watching, setWatching] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [diffView, setDiffView] = useState<"split" | "unified">(() =>
    localStorage.getItem("diffscape-diff-view") === "split" ? "split" : "unified",
  );
  const [notifications, setNotifications] = useState(
    () => localStorage.getItem("diffscape-notifications") === "true",
  );
  const searchRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef(0);
  const snapshotRef = useRef<RepositorySnapshot | null>(null);
  const snapshotRequestRef = useRef(0);
  const notificationPreferenceRef = useRef(notifications);
  const changeSignatureRef = useRef<string | null>(null);
  const resizeRef = useRef<{
    pane: "sidebar" | "list";
    startX: number;
    startWidth: number;
  } | null>(null);
  const t = useCallback(
    (key: Parameters<typeof translate>[1]) => translate(language, key),
    [language],
  );

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const appearance = new URLSearchParams(window.location.search).get("appearance");
    if (appearance === "dark" || appearance === "light")
      document.documentElement.dataset.appearance = appearance;
    else delete document.documentElement.dataset.appearance;
  }, []);

  const applySnapshot = useCallback(
    (next: RepositorySnapshot) => {
      const accepted = snapshotRef.current;
      if (accepted?.root === next.root && accepted.scannedAt > next.scannedAt) return;
      const signature = JSON.stringify(
        next.worktrees.map(worktree =>
          worktree.files.map(file => [
            file.id,
            file.status,
            file.staged,
            file.unstaged,
            file.untracked,
            file.committed,
          ]),
        ),
      );
      if (
        accepted?.root === next.root &&
        changeSignatureRef.current &&
        changeSignatureRef.current !== signature &&
        notificationPreferenceRef.current
      ) {
        const changed = next.worktrees.reduce(
          (total, worktree) => total + worktree.worktreeFileChanges,
          0,
        );
        sendNotification({
          title: t("changedNotificationTitle"),
          body: t("changedNotificationBody")
            .replace("{files}", String(changed))
            .replace("{worktrees}", String(next.worktrees.length)),
        });
      }
      changeSignatureRef.current = signature;
      snapshotRef.current = next;
      setSnapshot(next);
      if (next.activityEvents?.length) {
        setActivityEvents(previous => {
          const byId = new Map(previous.map(event => [event.id, event]));
          for (const event of next.activityEvents) byId.set(event.id, event);
          return [...byId.values()]
            .sort((a, b) => a.observedAt - b.observedAt)
            .slice(-100);
        });
      }
      setLastUpdated(next.scannedAt);
      setRepoError("");
    },
    [t],
  );

  const openRepo = useCallback(
    async (path?: string) => {
      const ticket = ++snapshotRequestRef.current;
      try {
        const chosen =
          path ??
          (isE2eMode
            ? takeNextE2eRepository()
            : await open({
                directory: true,
                multiple: false,
                title: t("chooseRepositoryTitle"),
              }));
        if (!chosen || Array.isArray(chosen)) {
          if (ticket === snapshotRequestRef.current) setLoading(false);
          return;
        }
        setLoading(true);
        setRepoError("");
        const initial = await gitApi.open(chosen, null);
        const savedBase = localStorage.getItem(`diffscape-base:${initial.root}`);
        const next = savedBase
          ? await gitApi.refresh(initial.root, savedBase)
          : initial;
        if (ticket !== snapshotRequestRef.current) return;
        applySnapshot(next);
        localStorage.setItem("diffscape-last-repository", next.root);
        setRegisteredRepos(previous => {
          const updated = [...new Set([...previous, next.root])];
          localStorage.setItem("diffscape-repositories", JSON.stringify(updated));
          return updated;
        });
        setSelectedWorktree("all");
      } catch (error) {
        if (ticket === snapshotRequestRef.current) setRepoError(String(error));
      } finally {
        if (ticket === snapshotRequestRef.current) setLoading(false);
      }
    },
    [applySnapshot, t],
  );

  const refresh = useCallback(async () => {
    if (!snapshot) return;
    const ticket = ++snapshotRequestRef.current;
    setLoading(true);
    try {
      const next = await gitApi.refresh(
        snapshot.root,
        snapshot.comparisonBaseIsManual ? snapshot.comparisonBase : null,
      );
      if (ticket === snapshotRequestRef.current) applySnapshot(next);
    } catch (error) {
      if (ticket === snapshotRequestRef.current) setRepoError(String(error));
    } finally {
      if (ticket === snapshotRequestRef.current) setLoading(false);
    }
  }, [applySnapshot, snapshot]);

  const changeComparisonBase = async (base: string | null) => {
    if (!snapshot) return;
    const ticket = ++snapshotRequestRef.current;
    if (base) localStorage.setItem(`diffscape-base:${snapshot.root}`, base);
    else localStorage.removeItem(`diffscape-base:${snapshot.root}`);
    setLoading(true);
    setRepoError("");
    try {
      const next = await gitApi.refresh(snapshot.root, base);
      if (ticket === snapshotRequestRef.current) applySnapshot(next);
    } catch (error) {
      if (ticket === snapshotRequestRef.current) setRepoError(String(error));
    } finally {
      if (ticket === snapshotRequestRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    const remembered = localStorage.getItem("diffscape-last-repository");
    if (!remembered || !isNative) return;
    const timer = window.setTimeout(() => void openRepo(remembered), 0);
    return () => window.clearTimeout(timer);
  }, [openRepo]);

  const repositoryRoot = snapshot?.root;
  const selectedBase = snapshot?.comparisonBaseIsManual
    ? snapshot.comparisonBase
    : null;
  useEffect(() => {
    if (!repositoryRoot || (!isNative && !isE2eMode)) return;
    let unlisten: (() => void) | undefined;
    let active = true;
    void gitApi
      .watch(repositoryRoot, selectedBase)
      .then(() => {
        if (active) setWatching(true);
      })
      .catch(() => {
        if (active) setWatching(false);
      });
    void gitApi
      .listen(payload => {
        if (active && payload.root === repositoryRoot) applySnapshot(payload);
      })
      .then(fn => {
        if (active) unlisten = fn;
        else fn();
      });
    return () => {
      active = false;
      unlisten?.();
      void gitApi.stop(repositoryRoot).catch(() => undefined);
      setWatching(false);
    };
  }, [repositoryRoot, selectedBase, applySnapshot]);

  useEffect(() => {
    if (!isNative) return;
    let active = true;
    let unlisten: (() => void) | undefined;
    void getCurrentWebview()
      .onDragDropEvent(event => {
        if (event.payload.type === "enter" || event.payload.type === "over")
          setDragActive(true);
        if (event.payload.type === "leave") setDragActive(false);
        if (event.payload.type === "drop") {
          setDragActive(false);
          const path = event.payload.paths[0];
          if (path) void openRepo(path);
        }
      })
      .then(stop => {
        if (active) unlisten = stop;
        else void stop();
      })
      .catch(() => undefined);
    return () => {
      active = false;
      unlisten?.();
    };
  }, [openRepo]);

  const filteredWorktrees = useMemo(
    () =>
      snapshot?.worktrees.filter(
        w => selectedWorktree === "all" || w.id === selectedWorktree,
      ) ?? [],
    [snapshot, selectedWorktree],
  );
  const groups = useMemo(() => samePathGroups(filteredWorktrees), [filteredWorktrees]);
  const counts = useMemo(() => aggregateCounts(filteredWorktrees), [filteredWorktrees]);
  const rows = useMemo(
    () =>
      filterTreeEntries(
        groups.flatMap(group =>
          group.entries.map(entry => ({ ...entry, shared: group.entries.length > 1 })),
        ),
        query,
        statusFilter,
        scopeFilter,
      ).sort((a, b) => {
        if (fileSort === "status")
          return (
            a.file.status.localeCompare(b.file.status) ||
            a.file.path.localeCompare(b.file.path)
          );
        if (fileSort === "worktree")
          return (
            a.worktree.path.localeCompare(b.worktree.path) ||
            a.file.path.localeCompare(b.file.path)
          );
        if (fileSort === "activity")
          return (
            (b.worktree.lastObservedChangeAt ?? -1) -
              (a.worktree.lastObservedChangeAt ?? -1) ||
            a.file.path.localeCompare(b.file.path)
          );
        return (
          a.file.path.localeCompare(b.file.path) ||
          a.worktree.path.localeCompare(b.worktree.path)
        );
      }),
    [groups, query, statusFilter, scopeFilter, fileSort],
  );
  const fileTree = useMemo(() => buildFileTree(rows, groupMode), [rows, groupMode]);
  const sortedWorktrees = useMemo(() => {
    const list = [...(snapshot?.worktrees ?? [])];
    if (worktreeSort === "activity") {
      return sortWorktreesByObservedActivity(list);
    } else {
      list.sort(
        (a, b) =>
          Number(b.isMain) - Number(a.isMain) ||
          (a.branch ?? a.path).localeCompare(b.branch ?? b.path),
      );
    }
    return list;
  }, [snapshot, worktreeSort]);
  const selectedFile = rows.find(row => row.file.id === selectedFileId) ?? null;
  const worktree = snapshot?.worktrees.find(w => w.id === selectedFile?.worktree.id);
  const diffKey =
    snapshot && selectedFile && worktree
      ? `${snapshot.root}::${selectedFile.file.id}::${diffMode}::${contextLines}::${worktree.base ?? "no-base"}::${snapshot.scannedAt}`
      : "";
  const currentDiff = diffState?.key === diffKey ? diffState : null;
  const diffContent = currentDiff?.content ?? "";
  const diffMeta = currentDiff?.meta ?? null;
  const diffLoading = Boolean(diffKey && !currentDiff);

  useEffect(() => {
    if (!snapshot || !selectedFile || !worktree || !diffKey) return;
    const ticket = ++requestRef.current;
    void gitApi
      .diff(
        worktree.path,
        worktree.id,
        selectedFile.file.path,
        selectedFile.file.oldPath,
        diffMode,
        worktree.base,
        contextLines,
      )
      .then(result => {
        if (ticket === requestRef.current)
          setDiffState({
            key: diffKey,
            content: result.content,
            meta: {
              binary: result.binary,
              tooLarge: result.tooLarge,
              truncated: result.truncated,
            },
          });
      })
      .catch(error => {
        if (ticket === requestRef.current)
          setDiffState({ key: diffKey, content: String(error), meta: null });
      });
    return () => {
      requestRef.current += 1;
    };
  }, [snapshot, selectedFile, worktree, diffMode, contextLines, diffKey]);

  const selectRow = (row: { worktree: Worktree; file: WorktreeFile }) =>
    setSelectedFileId(row.file.id);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const resize = resizeRef.current;
      if (!resize) return;
      const delta = event.clientX - resize.startX;
      if (resize.pane === "sidebar")
        setSidebarWidth(Math.max(160, Math.min(340, resize.startWidth + delta)));
      else setListWidth(Math.max(240, Math.min(520, resize.startWidth + delta)));
    };
    const end = () => {
      resizeRef.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
  }, []);
  const beginResize = (
    pane: "sidebar" | "list",
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    resizeRef.current = {
      pane,
      startX: event.clientX,
      startWidth: pane === "sidebar" ? sidebarWidth : listWidth,
    };
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(target.tagName)) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "r") {
        event.preventDefault();
        void refresh();
      }
      if (event.key === "Escape" && document.activeElement === searchRef.current) {
        setQuery("");
        searchRef.current?.blur();
      }
      if (
        (event.key === "ArrowDown" || event.key === "ArrowUp") &&
        !["INPUT", "TEXTAREA"].includes(target.tagName) &&
        rows.length
      ) {
        event.preventDefault();
        const index = rows.findIndex(row => row.file.id === selectedFile?.file.id);
        const next =
          rows[
            Math.max(
              0,
              Math.min(rows.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)),
            )
          ];
        if (next) selectRow(next);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [refresh, rows, selectedFile]);

  const reveal = async () => {
    if (!selectedFile) return;
    try {
      await gitApi.reveal(`${selectedFile.worktree.path}/${selectedFile.file.path}`);
    } catch (error) {
      setRepoError(String(error));
    }
  };
  const openSelectedInEditor = async () => {
    if (!selectedFile || !editorApp.trim()) return;
    try {
      await gitApi.editor(
        selectedFile.worktree.path,
        selectedFile.file.path,
        editorApp.trim(),
      );
    } catch (error) {
      setRepoError(String(error));
    }
  };
  const removeCurrentRepository = () => {
    if (!snapshot) return;
    const removed = snapshot.root;
    const remaining = registeredRepos.filter(path => path !== removed);
    setRegisteredRepos(remaining);
    localStorage.setItem("diffscape-repositories", JSON.stringify(remaining));
    if (localStorage.getItem("diffscape-last-repository") === removed) {
      if (remaining[0]) void openRepo(remaining[0]);
      else {
        localStorage.removeItem("diffscape-last-repository");
        snapshotRef.current = null;
        setSnapshot(null);
        setSelectedFileId(null);
        void gitApi.stop(removed);
      }
    }
  };
  const switchLanguage = () =>
    setLanguage(value => {
      const next = value === "en" ? "hi" : "en";
      localStorage.setItem("diffscape-language", next);
      return next;
    });
  const toggleNotifications = async () => {
    if (notifications) {
      notificationPreferenceRef.current = false;
      setNotifications(false);
      localStorage.setItem("diffscape-notifications", "false");
      return;
    }
    const granted =
      (await isPermissionGranted()) || (await requestPermission()) === "granted";
    if (granted) {
      notificationPreferenceRef.current = true;
      setNotifications(true);
      localStorage.setItem("diffscape-notifications", "true");
    }
  };

  return (
    <main
      className="app-shell"
      data-testid="app-shell"
      onDragOver={event => {
        if (isE2eMode && event.dataTransfer.types.includes("text/plain"))
          event.preventDefault();
      }}
      onDrop={event => {
        if (isE2eMode) {
          event.preventDefault();
          const path = event.dataTransfer.getData("text/plain");
          if (path) void openRepo(path);
        }
      }}
    >
      <header
        className={`topbar ${isNative ? "native-titlebar" : ""}`}
        data-tauri-drag-region
      >
        <div className="toolbar-title" data-tauri-drag-region>
          {!isNative && <span className="brand-name">Diffscape</span>}
          <span className="breadcrumb-root" title={snapshot?.root ?? ""}>
            {snapshot?.root ?? t("noRepoOpen")}
          </span>
        </div>
        <div className="topbar-actions" data-tauri-drag-region="false">
          {registeredRepos.length > 0 && (
            <select
              className="repo-switcher"
              value={snapshot?.root ?? ""}
              aria-label={t("repositories")}
              onChange={event => void openRepo(event.target.value)}
            >
              {!snapshot && <option value="">{t("repositories")}</option>}
              {registeredRepos.map(path => (
                <option key={path} value={path}>
                  {path.split(/[\\/]/).filter(Boolean).slice(-2).join("/")}
                </option>
              ))}
            </select>
          )}
          {snapshot && registeredRepos.length > 1 && (
            <button
              className="icon-button"
              aria-label={t("removeRepository")}
              title={t("removeRepository")}
              onClick={removeCurrentRepository}
            >
              <X size={14} />
            </button>
          )}
          {snapshot && (
            <button
              className="icon-button"
              aria-label={t("activityTimeline")}
              title={t("activityTimeline")}
              aria-expanded={showTimeline}
              onClick={() => setShowTimeline(value => !value)}
            >
              <Clock3 size={15} />
            </button>
          )}
          {snapshot && (
            <details className="settings-menu">
              <summary
                className="icon-button"
                aria-label={t("preferences")}
                title={t("preferences")}
              >
                <Settings2 size={15} />
              </summary>
              <div className="settings-popover">
                <label>
                  {t("editorApplication")}
                  <input
                    value={editorApp}
                    onChange={event => {
                      setEditorApp(event.target.value);
                      localStorage.setItem("diffscape-editor", event.target.value);
                    }}
                    placeholder={t("editorPlaceholder")}
                  />
                </label>
                <button
                  className="subtle-button"
                  disabled={!selectedFile || !editorApp.trim()}
                  onClick={() => void openSelectedInEditor()}
                >
                  {t("openInEditor")}
                </button>
              </div>
            </details>
          )}
          {snapshot && (
            <button
              className="icon-button"
              onClick={() => setSidebarOpen(value => !value)}
              aria-label={sidebarOpen ? t("hideWorktrees") : t("showWorktrees")}
              title={sidebarOpen ? t("hideWorktrees") : t("showWorktrees")}
            >
              <PanelLeftClose size={15} />
            </button>
          )}
          {snapshot && isNative && (
            <button
              className={`icon-button ${notifications ? "notification-on" : ""}`}
              onClick={() => void toggleNotifications()}
              aria-label={notifications ? t("notificationsOff") : t("notificationsOn")}
              title={notifications ? t("notificationsOn") : t("notificationsOff")}
            >
              <Bell size={15} />
            </button>
          )}
          {snapshot && (
            <button
              className="icon-button"
              onClick={() => void refresh()}
              aria-label={t("refresh")}
              title={`${t("refresh")} · ⌘R`}
            >
              <RefreshCw size={15} className={loading ? "spin" : ""} />
            </button>
          )}
          <button
            className="language-button"
            onClick={switchLanguage}
            aria-label={t("language")}
          >
            <Languages size={15} /> {language === "en" ? "EN" : "हि"}
          </button>
          <button
            className="toolbar-button"
            onClick={() => void openRepo()}
            title={t("open")}
          >
            <FolderOpen size={15} />
            <span>{t("open")}</span>
          </button>
        </div>
      </header>

      {showTimeline && snapshot && (
        <aside className="activity-popover" aria-label={t("activityTimeline")}>
          <div className="activity-heading">
            <strong>{t("activityTimeline")}</strong>
            <button
              className="subtle-icon"
              aria-label={t("clearTimeline")}
              title={t("clearTimeline")}
              onClick={() => setActivityEvents([])}
            >
              <X size={14} />
            </button>
          </div>
          <div className="activity-items" role="log" aria-live="polite">
            {activityEvents.length ? (
              [...activityEvents].reverse().map(item => (
                <article key={item.id}>
                  <time>
                    {new Date(item.observedAt).toLocaleTimeString(
                      language === "hi" ? "hi-IN" : "en-US",
                      { hour: "numeric", minute: "2-digit", second: "2-digit" },
                    )}
                  </time>
                  <strong>
                    {item.kind === "worktree-added"
                      ? t("worktreeAdded")
                      : item.kind === "worktree-removed"
                        ? t("worktreeRemoved")
                        : t("fileActivity")}
                  </strong>
                  <small>{item.worktreeLabel}</small>
                  {item.paths.length > 0 && <small>{item.paths.join(", ")}</small>}
                </article>
              ))
            ) : (
              <p>{t("noActivity")}</p>
            )}
          </div>
        </aside>
      )}
      {dragActive && (
        <div className="drop-overlay" role="status">
          {t("dropRepository")}
        </div>
      )}
      {!snapshot ? (
        <section className="welcome-screen">
          <h1>{t("emptyTitle")}</h1>
          <p>{t("emptyText")}</p>
          <button
            className="toolbar-button welcome-button"
            onClick={() => void openRepo()}
          >
            <FolderOpen size={16} />
            {t("choose")}
          </button>
          {repoError && (
            <div className="error-banner" role="alert">
              <CircleHelp size={15} />
              {repoError}
            </div>
          )}
        </section>
      ) : (
        <>
          <section className="comparison-toolbar" aria-label={t("comparisonBase")}>
            <label>
              {t("comparisonBase")}
              <select
                value={
                  snapshot.comparisonBaseIsManual
                    ? (snapshot.comparisonBase ?? "")
                    : "__default__"
                }
                onChange={event =>
                  void changeComparisonBase(
                    event.target.value === "__default__" ? null : event.target.value,
                  )
                }
              >
                <option value="__default__">{t("defaultBase")}</option>
                {snapshot.availableBases.map(base => (
                  <option key={base} value={base}>
                    {base}
                  </option>
                ))}
                {snapshot.comparisonBaseIsManual &&
                  snapshot.comparisonBase &&
                  !snapshot.availableBases.includes(snapshot.comparisonBase) && (
                    <option value={snapshot.comparisonBase}>
                      {snapshot.comparisonBase}
                    </option>
                  )}
              </select>
            </label>
            <form
              className="commit-base-form"
              onSubmit={event => {
                event.preventDefault();
                if (/^[0-9a-f]{7,64}$/i.test(commitInput))
                  void changeComparisonBase(commitInput);
              }}
            >
              <input
                value={commitInput}
                onChange={event => setCommitInput(event.target.value)}
                placeholder={t("commitId")}
                aria-label={t("commitId")}
              />
              <button
                className="toolbar-button"
                type="submit"
                disabled={!/^[0-9a-f]{7,64}$/i.test(commitInput)}
              >
                {t("useCommit")}
              </button>
            </form>
            <span
              className="baseline-detail"
              title={snapshot.comparisonBaseOid ?? snapshot.comparisonBaseError ?? ""}
            >
              {snapshot.comparisonBaseError
                ? snapshot.comparisonBaseError
                : `${snapshot.comparisonBase ?? "—"} · ${snapshot.comparisonBaseOid?.slice(0, 12) ?? "unresolved"}`}
            </span>
            <span className="aggregate-summary">
              {counts.uniquePaths} {t("uniquePaths")} · {counts.worktreeFileChanges}{" "}
              {t("fileChanges")}
            </span>
          </section>
          {snapshot.comparisonBaseError && (
            <div className="base-error" role="alert">
              {snapshot.comparisonBaseError}
            </div>
          )}
          <div
            className="workspace"
            style={
              {
                "--sidebar-width": sidebarOpen ? `${sidebarWidth}px` : "0px",
                "--list-width": `${listWidth}px`,
              } as CSSProperties
            }
          >
            <aside
              className={`worktree-sidebar ${sidebarOpen ? "" : "collapsed"}`}
              aria-label={t("worktrees")}
            >
              <div className="sidebar-heading">
                <span className="overline">{t("worktrees")}</span>
                <button
                  className="subtle-icon"
                  onClick={() => setSidebarOpen(false)}
                  aria-label={t("collapseSidebar")}
                >
                  <PanelLeftClose size={15} />
                </button>
              </div>
              <button
                className={`worktree-option ${selectedWorktree === "all" ? "selected" : ""}`}
                onClick={() => setSelectedWorktree("all")}
              >
                <div className="wt-icon all-icon">
                  <Workflow size={15} />
                </div>
                <div className="wt-text">
                  <strong>{t("all")}</strong>
                  <small>
                    {snapshot.worktrees.length} {t("worktreeCount")}
                  </small>
                </div>
                <span className="wt-count">{counts.worktreeFileChanges}</span>
              </button>
              <div className="sidebar-divider" />
              <span className="sidebar-section-label">{t("changes")}</span>
              <label className="activity-sort">
                {t("sortWorktrees")}
                <select
                  value={worktreeSort}
                  onChange={event =>
                    (() => {
                      const value = event.target.value as "branch" | "activity";
                      localStorage.setItem("diffscape-worktree-sort", value);
                      setWorktreeSort(value);
                    })()
                  }
                >
                  <option value="branch">{t("sortByBranch")}</option>
                  <option value="activity">{t("sortByActivity")}</option>
                </select>
              </label>
              <div className="worktree-list">
                {sortedWorktrees.map(worktree => (
                  <button
                    key={worktree.id}
                    className={`worktree-option ${selectedWorktree === worktree.id ? "selected" : ""}`}
                    onClick={() => setSelectedWorktree(worktree.id)}
                    title={worktree.path}
                  >
                    <div
                      className={`wt-icon ${worktree.isMain ? "main-icon" : "branch-icon"}`}
                    >
                      {worktree.isMain ? (
                        <GitBranch size={14} />
                      ) : (
                        <GitFork size={14} />
                      )}
                    </div>
                    <div className="wt-text">
                      <strong>
                        {worktree.detached
                          ? t("detached")
                          : (worktree.branch ?? t("unknownBranch"))}
                      </strong>
                      <small>
                        {worktree.isMain
                          ? t("main")
                          : worktree.path
                              .split(/[\\/]/)
                              .filter(Boolean)
                              .slice(-2)
                              .join("/")}
                      </small>
                      {worktreeSort === "activity" && (
                        <small className="observed-time">
                          {worktree.lastObservedChangeAt
                            ? `${t("lastObserved")}: ${new Date(worktree.lastObservedChangeAt).toLocaleTimeString(language === "hi" ? "hi-IN" : "en-US", { hour: "numeric", minute: "2-digit" })}`
                            : t("notObserved")}
                        </small>
                      )}
                    </div>
                    {worktree.worktreeFileChanges > 0 && (
                      <span className="wt-count">{worktree.worktreeFileChanges}</span>
                    )}
                  </button>
                ))}
              </div>
              <div className="sidebar-foot">
                <div className={`watch-state ${watching ? "is-live" : ""}`}>
                  <i />
                  {watching ? t("live") : t("offline")}
                </div>
                <span>
                  {lastUpdated
                    ? new Date(lastUpdated).toLocaleTimeString(
                        language === "hi" ? "hi-IN" : "en-US",
                        { hour: "numeric", minute: "2-digit" },
                      )
                    : "—"}
                </span>
              </div>
            </aside>
            <div
              className={`pane-splitter sidebar-splitter ${sidebarOpen ? "" : "is-hidden"}`}
              role="separator"
              aria-orientation="vertical"
              aria-label={t("resizeWorktreeSidebar")}
              aria-valuenow={sidebarWidth}
              tabIndex={sidebarOpen ? 0 : -1}
              onPointerDown={event => beginResize("sidebar", event)}
              onKeyDown={event => {
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  event.preventDefault();
                  setSidebarWidth(width =>
                    Math.max(
                      160,
                      Math.min(340, width + (event.key === "ArrowRight" ? 16 : -16)),
                    ),
                  );
                }
              }}
            />
            {!sidebarOpen && (
              <button
                className="expand-sidebar"
                onClick={() => setSidebarOpen(true)}
                aria-label={t("expandSidebar")}
              >
                <PanelLeftClose size={16} />
              </button>
            )}
            <section className="file-list-pane" aria-label={t("changes")}>
              <div className="pane-heading">
                <div>
                  <span className="overline">{t("changes")}</span>
                  <h2>
                    {selectedWorktree === "all"
                      ? t("all")
                      : (snapshot.worktrees.find(w => w.id === selectedWorktree)
                          ?.branch ?? t("detached"))}
                  </h2>
                </div>
                <span className="result-count">{rows.length}</span>
              </div>
              <label className="search-field">
                <Search size={14} />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder={t("search")}
                  aria-label={t("search")}
                />
                <kbd>/</kbd>
                {query && (
                  <button onClick={() => setQuery("")} aria-label={t("clearSearch")}>
                    <X size={12} />
                  </button>
                )}
              </label>
              <div className="filter-row">
                <select
                  value={statusFilter}
                  onChange={event => setStatusFilter(event.target.value)}
                  aria-label={t("allStatuses")}
                >
                  <option value="all">{t("allStatuses")}</option>
                  {[
                    "modified",
                    "added",
                    "deleted",
                    "renamed",
                    "untracked",
                    "unmerged",
                  ].map(status => (
                    <option key={status} value={status}>
                      {t(
                        status === "untracked"
                          ? "untrackedStatus"
                          : (status as
                              | "modified"
                              | "added"
                              | "deleted"
                              | "renamed"
                              | "unmerged"),
                      )}
                    </option>
                  ))}
                </select>
                <select
                  value={scopeFilter}
                  onChange={event =>
                    setScopeFilter(event.target.value as typeof scopeFilter)
                  }
                  aria-label={t("changeScope")}
                >
                  {(
                    ["all", "staged", "unstaged", "untracked", "committed"] as const
                  ).map(scope => (
                    <option key={scope} value={scope}>
                      {t(scope === "all" ? "allChanges" : scope)}
                    </option>
                  ))}
                </select>
                <select
                  value={fileSort}
                  aria-label={t("sortChanges")}
                  onChange={event => {
                    const value = event.target.value as FileSort;
                    setFileSort(value);
                    localStorage.setItem("diffscape-file-sort", value);
                  }}
                >
                  <option value="path">{t("sortByPath")}</option>
                  <option value="status">{t("sortByStatus")}</option>
                  <option value="worktree">{t("sortByWorktree")}</option>
                  <option value="activity">{t("sortByObservedActivity")}</option>
                </select>
                <select
                  value={groupMode}
                  aria-label={t("groupChanges")}
                  onChange={event => {
                    const value = event.target.value as GroupMode;
                    setGroupMode(value);
                    localStorage.setItem("diffscape-group-mode", value);
                  }}
                >
                  <option value="path">{t("groupByPath")}</option>
                  <option value="worktree">{t("groupByWorktree")}</option>
                </select>
              </div>
              <div className="file-table-head">
                <span>{t("path")}</span>
                <span>{t("status")}</span>
              </div>
              <div className="file-rows" role="tree" aria-label={t("changes")}>
                <FileTreeView
                  nodes={fileTree}
                  selectedId={selectedFile?.file.id ?? null}
                  onSelect={selectRow}
                  collapsedDirectories={collapsedDirectories}
                  setCollapsedDirectories={setCollapsedDirectories}
                  collapsedSharedPaths={collapsedSharedPaths}
                  setCollapsedSharedPaths={setCollapsedSharedPaths}
                  worktreeLabel={item => item.branch ?? t("detached")}
                  worktreesLabel={t("worktreePlural")}
                />
                {!rows.length && (
                  <div className="empty-list">
                    <div className="empty-list-icon">
                      <FileDiff size={19} />
                    </div>
                    <p>
                      {snapshot.worktrees.every(w => w.files.length === 0)
                        ? t("noChanges")
                        : t("noChanges")}
                    </p>
                  </div>
                )}
              </div>
              <div className="list-footer">
                <span>
                  {rows.length} {t("fileChanges")}
                </span>
                <span>
                  <Command size={11} /> K
                </span>
              </div>
            </section>
            <div
              className="pane-splitter list-splitter"
              role="separator"
              aria-orientation="vertical"
              aria-label={t("resizeFileList")}
              aria-valuenow={listWidth}
              tabIndex={0}
              onPointerDown={event => beginResize("list", event)}
              onKeyDown={event => {
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  event.preventDefault();
                  setListWidth(width =>
                    Math.max(
                      240,
                      Math.min(520, width + (event.key === "ArrowRight" ? 16 : -16)),
                    ),
                  );
                }
              }}
            />
            <section className="diff-pane" aria-label={t("diffViewer")}>
              {selectedFile ? (
                <>
                  <div className="diff-toolbar">
                    <div className="diff-file-title">
                      <div className="diff-file-icon">
                        <FileCode2 size={15} />
                      </div>
                      <div>
                        <strong>{selectedFile.file.path.split("/").at(-1)}</strong>
                        <small>
                          {selectedFile.worktree.branch ?? t("detached")} <span>·</span>{" "}
                          {selectedFile.file.path}
                        </small>
                      </div>
                    </div>
                    <div className="diff-actions">
                      <button
                        className="subtle-button"
                        onClick={() => void reveal()}
                        title={t("reveal")}
                      >
                        <FolderOpen size={14} />
                        <span>{t("reveal")}</span>
                      </button>
                      <button
                        className="subtle-button"
                        onClick={() => void openSelectedInEditor()}
                        title={t("openInEditor")}
                        disabled={!editorApp.trim()}
                      >
                        <ExternalLink size={14} />
                        <span>{t("openInEditor")}</span>
                      </button>
                      <div className="view-toggle" aria-label={t("diffLayout")}>
                        <button
                          className={diffView === "unified" ? "active" : ""}
                          onClick={() => {
                            setDiffView("unified");
                            localStorage.setItem("diffscape-diff-view", "unified");
                          }}
                          title={t("unifiedDiff")}
                        >
                          <FileDiff size={14} />
                        </button>
                        <button
                          className={diffView === "split" ? "active" : ""}
                          onClick={() => {
                            setDiffView("split");
                            localStorage.setItem("diffscape-diff-view", "split");
                          }}
                          title={t("splitDiff")}
                        >
                          <PanelLeftClose size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="diff-subtoolbar">
                    <label className="context-control">
                      {t("contextLines")}
                      <select
                        aria-label={t("contextLines")}
                        value={contextLines}
                        onChange={event => {
                          const value = Number(event.target.value);
                          setContextLines(value);
                          localStorage.setItem("diffscape-diff-context", String(value));
                        }}
                      >
                        <option value={0}>0</option>
                        <option value={1}>1</option>
                        <option value={3}>3</option>
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                      </select>
                    </label>
                    <div className="mode-tabs" role="tablist" aria-label={t("mode")}>
                      <button
                        role="tab"
                        aria-selected={diffMode === "working"}
                        className={diffMode === "working" ? "active" : ""}
                        onClick={() => setDiffMode("working")}
                      >
                        {t("working")}
                      </button>
                      <button
                        role="tab"
                        aria-selected={diffMode === "staged"}
                        className={diffMode === "staged" ? "active" : ""}
                        onClick={() => setDiffMode("staged")}
                      >
                        {t("staged")}
                      </button>
                      <button
                        role="tab"
                        aria-selected={diffMode === "total"}
                        className={diffMode === "total" ? "active" : ""}
                        onClick={() => setDiffMode("total")}
                      >
                        {t("total")}
                      </button>
                    </div>
                    <span className="base-label">
                      {diffMode === "total"
                        ? `${t("base")}: ${selectedFile.worktree.base?.slice(0, 8) ?? "—"}`
                        : selectedFile.file.staged && selectedFile.file.unstaged
                          ? t("stagedAndUnstaged")
                          : selectedFile.file.staged
                            ? t("staged")
                            : selectedFile.file.untracked
                              ? t("untrackedStatus")
                              : t("working")}
                    </span>
                  </div>
                  {selectedFile.worktree.baseError && diffMode === "total" && (
                    <div className="diff-notice">
                      <CircleHelp size={14} />
                      {t("noBase")}
                    </div>
                  )}
                  <div
                    className={`diff-content ${diffView === "split" ? "split-view" : ""}`}
                  >
                    {diffLoading ? (
                      <div className="diff-empty">
                        <RefreshCw className="spin" size={18} />
                        <span>{t("loading")}</span>
                      </div>
                    ) : diffMeta?.tooLarge ? (
                      <div className="diff-empty">
                        <CircleHelp size={19} />
                        <span>{t("large")}</span>
                      </div>
                    ) : diffMeta?.binary ? (
                      <div className="diff-empty">
                        <FileCode2 size={20} />
                        <span>{t("binary")}</span>
                      </div>
                    ) : diffContent ? (
                      <>
                        {diffMeta?.truncated && (
                          <div className="diff-notice">{t("truncated")}</div>
                        )}
                        <DiffText content={diffContent} split={diffView === "split"} />
                      </>
                    ) : (
                      <div className="diff-empty">
                        <FileDiff size={20} />
                        <span>{t("selectFile")}</span>
                      </div>
                    )}
                  </div>
                  <div className="diff-statusbar">
                    <span className="status-pill">
                      <i
                        className={`status-dot ${statusClasses[selectedFile.file.status] ?? "status-modified"}`}
                      />
                      {selectedFile.file.status === "untracked"
                        ? t("untrackedStatus")
                        : t(
                            selectedFile.file.status as
                              "modified" | "added" | "deleted" | "renamed" | "unmerged",
                          )}
                    </span>
                    <span>
                      {selectedFile.file.staged && (
                        <span className="mini-state">● {t("staged")}</span>
                      )}
                      {selectedFile.file.unstaged && (
                        <span className="mini-state">● {t("unstaged")}</span>
                      )}
                      {selectedFile.file.untracked && (
                        <span className="mini-state">● {t("untracked")}</span>
                      )}
                      {selectedFile.file.committed && (
                        <span className="mini-state">● {t("committed")}</span>
                      )}
                    </span>
                    <span className="line-count">
                      {diffContent.split("\n").length > 1
                        ? `${diffContent.split("\n").length - 1} ${t("lines")}`
                        : "—"}
                    </span>
                  </div>
                </>
              ) : (
                <div className="diff-unselected">
                  <div className="unselected-art">
                    <FileDiff size={24} />
                    <ArrowDown size={15} />
                  </div>
                  <span>{t("selectFile")}</span>
                  <small>{t("selectChange")}</small>
                </div>
              )}
            </section>
          </div>
          {repoError && (
            <div className="toast-error" role="alert">
              <CircleHelp size={15} />
              {repoError}
              <button onClick={() => setRepoError("")} aria-label={t("dismiss")}>
                <X size={14} />
              </button>
            </div>
          )}
          <footer className="statusbar">
            <div>
              <span className={`connection-dot ${watching ? "online" : ""}`} />
              {watching ? t("live") : t("offline")}
            </div>
            <span>
              {t("committedMode")}: {counts.committed}
            </span>
            <span className="statusbar-right">
              <ArrowUp size={11} />
              <ArrowDown size={11} /> {t("navigate")} <kbd>↑</kbd>
              <kbd>↓</kbd>
              <span className="statusbar-divider" />
              <span>
                {loading
                  ? t("syncing")
                  : lastUpdated
                    ? `${t("updated")} ${new Date(lastUpdated).toLocaleTimeString(language === "hi" ? "hi-IN" : "en-US", { hour: "numeric", minute: "2-digit" })}`
                    : t("ready")}
              </span>
            </span>
          </footer>
        </>
      )}
    </main>
  );
}

function FileTreeView({
  nodes,
  selectedId,
  onSelect,
  collapsedDirectories,
  setCollapsedDirectories,
  collapsedSharedPaths,
  setCollapsedSharedPaths,
  worktreeLabel,
  worktreesLabel,
}: {
  nodes: FileTreeNode[];
  selectedId: string | null;
  onSelect: (entry: TreeEntry) => void;
  collapsedDirectories: Set<string>;
  setCollapsedDirectories: React.Dispatch<React.SetStateAction<Set<string>>>;
  collapsedSharedPaths: Set<string>;
  setCollapsedSharedPaths: React.Dispatch<React.SetStateAction<Set<string>>>;
  worktreeLabel: (worktree: Worktree) => string;
  worktreesLabel: string;
}) {
  return (
    <>
      {nodes.map(node => {
        const hasChildren = node.children.length > 0;
        if (hasChildren) {
          const collapsed = collapsedDirectories.has(node.path);
          return (
            <div
              className="tree-node"
              role="treeitem"
              aria-expanded={!collapsed}
              key={node.path}
            >
              <button
                className="tree-row directory-row"
                onClick={() =>
                  setCollapsedDirectories(previous => {
                    const next = new Set(previous);
                    if (next.has(node.path)) next.delete(node.path);
                    else next.add(node.path);
                    return next;
                  })
                }
              >
                <ChevronRight
                  size={13}
                  className={`tree-chevron ${collapsed ? "" : "open"}`}
                />
                {node.worktree ? (
                  <GitBranch size={14} className="file-glyph" />
                ) : (
                  <Folder size={14} className="file-glyph" />
                )}
                <span className="tree-name">{node.name}</span>
                {node.worktree && (
                  <small className="tree-group-count">
                    {node.worktree.worktreeFileChanges}
                  </small>
                )}
              </button>
              {!collapsed && (
                <div role="group" className="tree-children">
                  <FileTreeView
                    nodes={node.children}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    collapsedDirectories={collapsedDirectories}
                    setCollapsedDirectories={setCollapsedDirectories}
                    collapsedSharedPaths={collapsedSharedPaths}
                    setCollapsedSharedPaths={setCollapsedSharedPaths}
                    worktreeLabel={worktreeLabel}
                    worktreesLabel={worktreesLabel}
                  />
                </div>
              )}
            </div>
          );
        }
        const shared = node.entries.length > 1;
        const hidden = collapsedSharedPaths.has(node.path);
        if (shared)
          return (
            <div
              className="tree-node"
              role="treeitem"
              aria-expanded={!hidden}
              key={node.path}
            >
              <button
                className="tree-row shared-path-row"
                onClick={() =>
                  setCollapsedSharedPaths(previous => {
                    const next = new Set(previous);
                    if (next.has(node.path)) next.delete(node.path);
                    else next.add(node.path);
                    return next;
                  })
                }
              >
                <ChevronRight
                  size={13}
                  className={`tree-chevron ${hidden ? "" : "open"}`}
                />
                <FileCode2 size={14} className="file-glyph" />
                <span className="tree-name">{node.name}</span>
                <small className="tree-group-count">
                  {node.entries.length} {worktreesLabel}
                </small>
              </button>
              {!hidden && (
                <div role="group" className="tree-children">
                  {node.entries.map(entry => (
                    <FileEntryRow
                      key={entry.file.id}
                      entry={entry}
                      selected={selectedId === entry.file.id}
                      onSelect={onSelect}
                      worktreeLabel={worktreeLabel}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        return node.entries.map(entry => (
          <FileEntryRow
            key={entry.file.id}
            entry={entry}
            selected={selectedId === entry.file.id}
            onSelect={onSelect}
            worktreeLabel={worktreeLabel}
          />
        ));
      })}
    </>
  );
}

function FileEntryRow({
  entry,
  selected,
  onSelect,
  worktreeLabel,
}: {
  entry: TreeEntry;
  selected: boolean;
  onSelect: (entry: TreeEntry) => void;
  worktreeLabel: (worktree: Worktree) => string;
}) {
  return (
    <button
      role="treeitem"
      aria-selected={selected}
      className={`tree-row file-row ${selected ? "selected" : ""}`}
      onClick={() => onSelect(entry)}
      title={`${entry.worktree.path}/${entry.file.path}`}
    >
      <span className="tree-indent" />
      <FileCode2 size={14} className="file-glyph" />
      <span className="tree-file-label">
        <strong title={entry.file.path}>{entry.file.path.split("/").at(-1)}</strong>
        <small>
          {entry.file.oldPath ? `${entry.file.oldPath} → ` : ""}
          {worktreeLabel(entry.worktree)} ·{" "}
          {entry.worktree.path.split(/[\\/]/).filter(Boolean).slice(-2).join("/")}
        </small>
      </span>
      <span
        className={`status-dot ${statusClasses[entry.file.status] ?? "status-modified"}`}
        title={entry.file.status}
      />
    </button>
  );
}

function DiffText({ content, split }: { content: string; split: boolean }) {
  const lines = content.split("\n");
  if (split) {
    const output: Array<{ left: string; right: string; type: string }> = [];
    for (let index = 0; index < lines.length;) {
      const line = lines[index] ?? "";
      if (
        line.startsWith("diff --git") ||
        line.startsWith("index ") ||
        line.startsWith("--- ") ||
        line.startsWith("+++ ") ||
        line.startsWith("@@")
      ) {
        output.push({ left: line, right: "", type: "header-line" });
        index += 1;
        continue;
      }
      if (
        (line.startsWith("-") && !line.startsWith("---")) ||
        (line.startsWith("+") && !line.startsWith("+++"))
      ) {
        const removed: string[] = [];
        const added: string[] = [];
        while (
          index < lines.length &&
          ((lines[index]?.startsWith("-") && !lines[index]?.startsWith("---")) ||
            (lines[index]?.startsWith("+") && !lines[index]?.startsWith("+++")))
        ) {
          const current = lines[index] ?? "";
          (current.startsWith("-") ? removed : added).push(current);
          index += 1;
        }
        for (let row = 0; row < Math.max(removed.length, added.length); row += 1) {
          output.push({
            left: removed[row] ?? "",
            right: added[row] ?? "",
            type: "split-change",
          });
        }
        continue;
      }
      output.push({ left: line, right: "", type: "context-line" });
      index += 1;
    }
    return (
      <div className="diff-split">
        {output.map((row, index) => (
          <div
            className={`split-row ${row.type}`}
            key={`${index}-${row.left}-${row.right}`}
          >
            <span className={row.left.startsWith("-") ? "removed-side" : ""}>
              {row.left}
            </span>
            <span className={row.right.startsWith("+") ? "added-side" : ""}>
              {row.right}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <pre className="diff-text">
      {lines.map((line, index) => {
        const header =
          line.startsWith("diff --git") ||
          line.startsWith("index ") ||
          line.startsWith("--- ") ||
          line.startsWith("+++ ") ||
          line.startsWith("@@");
        const type =
          line.startsWith("+") && !line.startsWith("+++")
            ? "added-line"
            : line.startsWith("-") && !line.startsWith("---")
              ? "removed-line"
              : header
                ? "header-line"
                : "";
        return (
          <span className={`diff-line ${type}`} key={`${index}-${line.slice(0, 16)}`}>
            <span className="line-number">
              {line.startsWith("+") ? "+" : line.startsWith("-") ? "−" : " "}
            </span>
            <span>{line || " "}</span>
          </span>
        );
      })}
    </pre>
  );
}
