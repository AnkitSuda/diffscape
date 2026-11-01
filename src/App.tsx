import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Bell,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Command,
  FileCode2,
  FileDiff,
  FolderOpen,
  GitBranch,
  GitCommitHorizontal,
  GitFork,
  Languages,
  PanelLeftClose,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Workflow,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  DiffMode,
  Language,
  RepositorySnapshot,
  Worktree,
  WorktreeFile,
} from "./lib/contracts";
import { aggregateCounts, samePathGroups } from "./lib/contracts";
import { gitApi, isNative } from "./lib/git";
import { translate } from "./lib/i18n";

const statusClasses: Record<string, string> = {
  modified: "status-modified",
  added: "status-added",
  deleted: "status-deleted",
  renamed: "status-renamed",
  untracked: "status-untracked",
  unmerged: "status-unmerged",
};

export default function App() {
  const [snapshot, setSnapshot] = useState<RepositorySnapshot | null>(null);
  const [repoError, setRepoError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedWorktree, setSelectedWorktree] = useState<string>("all");
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [diffMode, setDiffMode] = useState<DiffMode>("working");
  const [diffState, setDiffState] = useState<{
    key: string;
    content: string;
    meta: { binary: boolean; tooLarge: boolean; truncated: boolean } | null;
  } | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [language, setLanguage] = useState<Language>(() =>
    localStorage.getItem("diffscape-language") === "hi" ? "hi" : "en",
  );
  const [showTimeline, setShowTimeline] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [watching, setWatching] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [diffView, setDiffView] = useState<"split" | "unified">("unified");
  const [notifications, setNotifications] = useState(
    () => localStorage.getItem("diffscape-notifications") === "true",
  );
  const searchRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef(0);
  const snapshotRef = useRef<RepositorySnapshot | null>(null);
  const snapshotRequestRef = useRef(0);
  const notificationPreferenceRef = useRef(notifications);
  const changeSignatureRef = useRef<string | null>(null);
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const applySnapshot = useCallback((next: RepositorySnapshot) => {
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
        title: "Diffscape · changes updated",
        body: `${changed} worktree-file changes across ${next.worktrees.length} worktrees.`,
      });
    }
    changeSignatureRef.current = signature;
    snapshotRef.current = next;
    setSnapshot(next);
    setLastUpdated(next.scannedAt);
    setRepoError("");
  }, []);

  const openRepo = useCallback(
    async (path?: string) => {
      try {
        const chosen =
          path ??
          (await open({
            directory: true,
            multiple: false,
            title: "Choose a Git repository",
          }));
        if (!chosen || Array.isArray(chosen)) return;
        const ticket = ++snapshotRequestRef.current;
        setLoading(true);
        setRepoError("");
        const next = await gitApi.open(chosen);
        if (ticket !== snapshotRequestRef.current) return;
        applySnapshot(next);
        localStorage.setItem("diffscape-last-repository", next.root);
        setSelectedWorktree("all");
      } catch (error) {
        setRepoError(String(error));
      } finally {
        setLoading(false);
      }
    },
    [applySnapshot],
  );

  const refresh = useCallback(async () => {
    if (!snapshot) return;
    const ticket = ++snapshotRequestRef.current;
    setLoading(true);
    try {
      const next = await gitApi.refresh(snapshot.root);
      if (ticket === snapshotRequestRef.current) applySnapshot(next);
    } catch (error) {
      setRepoError(String(error));
    } finally {
      setLoading(false);
    }
  }, [applySnapshot, snapshot]);

  useEffect(() => {
    const remembered = localStorage.getItem("diffscape-last-repository");
    if (!remembered || !isNative) return;
    const timer = window.setTimeout(() => void openRepo(remembered), 0);
    return () => window.clearTimeout(timer);
  }, [openRepo]);

  const repositoryRoot = snapshot?.root;
  useEffect(() => {
    if (!repositoryRoot || !isNative) return;
    let unlisten: (() => void) | undefined;
    let active = true;
    void gitApi
      .watch(repositoryRoot)
      .then(() => setWatching(true))
      .catch(() => setWatching(false));
    void listen<RepositorySnapshot>("repository-changed", event => {
      if (active && event.payload.root === repositoryRoot) applySnapshot(event.payload);
    }).then(fn => {
      unlisten = fn;
    });
    return () => {
      active = false;
      unlisten?.();
      void gitApi.stop(repositoryRoot).catch(() => undefined);
      setWatching(false);
    };
  }, [repositoryRoot, applySnapshot]);

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
      groups
        .flatMap(group =>
          group.entries.map(entry => ({ ...entry, shared: group.entries.length > 1 })),
        )
        .filter(
          row =>
            row.file.path.toLocaleLowerCase().includes(query.toLocaleLowerCase()) ||
            row.file.oldPath?.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
        )
        .filter(row => statusFilter === "all" || row.file.status === statusFilter)
        .sort(
          (a, b) =>
            a.file.path.localeCompare(b.file.path) ||
            a.worktree.path.localeCompare(b.worktree.path),
        ),
    [groups, query, statusFilter],
  );
  const selectedFile = rows.find(row => row.file.id === selectedFileId) ?? null;
  const worktree = snapshot?.worktrees.find(w => w.id === selectedFile?.worktree.id);
  const diffKey =
    snapshot && selectedFile && worktree
      ? `${snapshot.root}::${selectedFile.file.id}::${diffMode}::${worktree.base ?? "no-base"}::${snapshot.scannedAt}`
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
  }, [snapshot, selectedFile, worktree, diffMode, diffKey]);

  const selectRow = (row: { worktree: Worktree; file: WorktreeFile }) =>
    setSelectedFileId(row.file.id);
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
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <Workflow size={19} strokeWidth={2.2} />
          </div>
          <span className="brand-name">Diffscape</span>
          <span className="brand-tag">WORKTREE STUDIO</span>
        </div>
        <div className="topbar-center">
          <span className="breadcrumb-root">
            {snapshot?.root ?? "Your Git workspace"}
          </span>
          {snapshot && (
            <span className="repo-badge">
              <GitFork size={12} /> {snapshot.worktrees.length} worktrees
            </span>
          )}
        </div>
        <div className="topbar-actions">
          {snapshot && isNative && (
            <button
              className={`icon-button ${notifications ? "notification-on" : ""}`}
              onClick={() => void toggleNotifications()}
              aria-label={
                notifications ? "Turn off notifications" : "Turn on notifications"
              }
              title={notifications ? "Notifications on" : "Notifications off"}
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
          <button className="primary-button" onClick={() => void openRepo()}>
            <FolderOpen size={15} /> {t("open")}
          </button>
        </div>
      </header>

      {!snapshot ? (
        <section className="welcome-screen">
          <div className="welcome-art" aria-hidden="true">
            <div className="art-orbit orbit-one" />
            <div className="art-orbit orbit-two" />
            <div className="art-center">
              <Workflow size={48} />
            </div>
            <div className="art-node node-a">
              <GitBranch size={16} />
            </div>
            <div className="art-node node-b">
              <FileDiff size={16} />
            </div>
            <div className="art-node node-c">
              <GitCommitHorizontal size={17} />
            </div>
          </div>
          <div className="welcome-eyebrow">
            <Sparkles size={13} /> BUILT FOR THE WAY YOU BRANCH
          </div>
          <h1>{t("emptyTitle")}</h1>
          <p>{t("emptyText")}</p>
          <button
            className="primary-button welcome-button"
            onClick={() => void openRepo()}
          >
            <FolderOpen size={16} />
            {t("choose")}
          </button>
          <div className="welcome-foot">
            <span>
              <Check size={13} /> Read-only by design
            </span>
            <span>
              <GitFork size={13} /> All worktrees, one view
            </span>
            <span>
              <Activity size={13} /> Local and private
            </span>
          </div>
          {repoError && (
            <div className="error-banner" role="alert">
              <CircleHelp size={15} />
              {repoError}
            </div>
          )}
        </section>
      ) : (
        <>
          <section className="overview-strip">
            <div className="overview-label">
              <span className="overline">{t("overview")}</span>
              <span className="overview-title">
                {snapshot.root.split(/[\\/]/).filter(Boolean).at(-1)}
              </span>
            </div>
            <div className="overview-stat">
              <span className="stat-number">{counts.uniquePaths}</span>
              <span className="stat-caption">{t("uniquePaths")}</span>
            </div>
            <div className="overview-stat">
              <span className="stat-number">{counts.worktreeFileChanges}</span>
              <span className="stat-caption">{t("fileChanges")}</span>
            </div>
            <div className="overview-breakdown">
              <span>
                <i className="dot dot-staged" />
                {t("staged")} <b>{counts.staged}</b>
              </span>
              <span>
                <i className="dot dot-unstaged" />
                {t("unstaged")} <b>{counts.unstaged}</b>
              </span>
              <span>
                <i className="dot dot-untracked" />
                {t("untracked")} <b>{counts.untracked}</b>
              </span>
              <span>
                <i className="dot dot-committed" />
                {t("committed")} <b>{counts.committed}</b>
              </span>
            </div>
            <button
              className={`timeline-toggle ${showTimeline ? "active" : ""}`}
              onClick={() => setShowTimeline(value => !value)}
            >
              <Clock3 size={14} />
              {t("timeline")}
            </button>
          </section>
          {showTimeline && (
            <div className="timeline-panel">
              <div className="timeline-mark" />
              <div>
                <strong>{t("live")}</strong>
                <p>
                  {lastUpdated
                    ? `Repository snapshot refreshed ${new Date(lastUpdated).toLocaleTimeString(language === "hi" ? "hi-IN" : "en-US", { hour: "numeric", minute: "2-digit" })}. This is scan activity, not a commit timeline.`
                    : "Waiting for first scan."}
                </p>
              </div>
              <span className="live-pill">
                <i /> {watching ? t("live") : t("offline")}
              </span>
            </div>
          )}
          <div className="workspace">
            <aside
              className={`worktree-sidebar ${sidebarOpen ? "" : "collapsed"}`}
              aria-label={t("worktrees")}
            >
              <div className="sidebar-heading">
                <span className="overline">{t("worktrees")}</span>
                <button
                  className="subtle-icon"
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Collapse sidebar"
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
                  <small>{snapshot.worktrees.length} worktrees</small>
                </div>
                <span className="wt-count">{counts.worktreeFileChanges}</span>
              </button>
              <div className="sidebar-divider" />
              <span className="sidebar-section-label">{t("changes")}</span>
              <div className="worktree-list">
                {snapshot.worktrees.map(worktree => (
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
                          : (worktree.branch ?? "(unknown branch)")}
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
            {!sidebarOpen && (
              <button
                className="expand-sidebar"
                onClick={() => setSidebarOpen(true)}
                aria-label="Expand sidebar"
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
                  <button onClick={() => setQuery("")} aria-label="Clear search">
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
                  {["modified", "added", "deleted", "renamed", "untracked"].map(
                    status => (
                      <option key={status} value={status}>
                        {t(
                          status === "untracked"
                            ? "untrackedStatus"
                            : (status as "modified" | "added" | "deleted" | "renamed"),
                        )}
                      </option>
                    ),
                  )}
                </select>
                <button className="filter-more" title="Filter options">
                  <Settings2 size={13} />
                  <ChevronDown size={11} />
                </button>
              </div>
              <div className="file-table-head">
                <span>{t("path")}</span>
                <span>{t("status")}</span>
              </div>
              <div className="file-rows" role="listbox" aria-label={t("changes")}>
                {rows.map(row => (
                  <button
                    key={row.file.id}
                    role="option"
                    aria-selected={selectedFile?.file.id === row.file.id}
                    className={`file-row ${selectedFile?.file.id === row.file.id ? "selected" : ""}`}
                    onClick={() => selectRow(row)}
                  >
                    <FileCode2 size={15} className="file-glyph" />
                    <span className="file-name-wrap">
                      <strong title={row.file.path}>
                        {row.file.path.split("/").at(-1)}
                      </strong>
                      <small>
                        {row.file.oldPath ? `${row.file.oldPath} → ` : ""}
                        {row.file.path.includes("/")
                          ? row.file.path.split("/").slice(0, -1).join("/")
                          : "."}
                        {selectedWorktree === "all"
                          ? ` · ${row.worktree.branch ?? t("detached")}`
                          : ""}
                      </small>
                    </span>
                    {row.shared && (
                      <span className="shared-marker" title={t("conflictNote")}>
                        ↗
                      </span>
                    )}
                    <span
                      className={`status-dot ${statusClasses[row.file.status] ?? "status-modified"}`}
                      title={row.file.status}
                    />
                  </button>
                ))}
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
            <section className="diff-pane" aria-label="Diff viewer">
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
                      <div className="view-toggle" aria-label="Diff layout">
                        <button
                          className={diffView === "unified" ? "active" : ""}
                          onClick={() => setDiffView("unified")}
                          title="Unified diff"
                        >
                          <FileDiff size={14} />
                        </button>
                        <button
                          className={diffView === "split" ? "active" : ""}
                          onClick={() => setDiffView("split")}
                          title="Split diff"
                        >
                          <PanelLeftClose size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="diff-subtoolbar">
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
                          ? "Staged + unstaged"
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
                      {selectedFile.file.status}
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
                        ? `${diffContent.split("\n").length - 1} lines`
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
                  <small>Select a change from the list to inspect it.</small>
                </div>
              )}
            </section>
          </div>
          {repoError && (
            <div className="toast-error" role="alert">
              <CircleHelp size={15} />
              {repoError}
              <button onClick={() => setRepoError("")} aria-label="Dismiss">
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
              <ArrowDown size={11} /> Navigate <kbd>↑</kbd>
              <kbd>↓</kbd>
              <span className="statusbar-divider" />
              <span>
                {loading
                  ? t("syncing")
                  : lastUpdated
                    ? `Updated ${new Date(lastUpdated).toLocaleTimeString(language === "hi" ? "hi-IN" : "en-US", { hour: "numeric", minute: "2-digit" })}`
                    : "Ready"}
              </span>
            </span>
          </footer>
        </>
      )}
    </main>
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
