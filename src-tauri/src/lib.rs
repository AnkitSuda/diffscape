use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::io::Read;
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, Arc, Mutex,
    },
    thread,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, State};

const MAX_FILES: usize = 2_000;
const MAX_DIFF_BYTES: usize = 1_500_000;
const MAX_FILE_BYTES: u64 = 2_000_000;
const MAX_GIT_OUTPUT_BYTES: usize = 16_000_000;
const GIT_TIMEOUT: Duration = Duration::from_secs(20);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorktreeFile {
    id: String,
    path: String,
    old_path: Option<String>,
    status: String,
    staged: bool,
    unstaged: bool,
    untracked: bool,
    committed: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Worktree {
    id: String,
    path: String,
    branch: Option<String>,
    head: String,
    detached: bool,
    is_main: bool,
    base: Option<String>,
    base_error: Option<String>,
    files: Vec<WorktreeFile>,
    unique_paths: usize,
    worktree_file_changes: usize,
    staged_count: usize,
    unstaged_count: usize,
    untracked_count: usize,
    committed_count: usize,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RepositorySnapshot {
    root: String,
    worktrees: Vec<Worktree>,
    scanned_at: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DiffResponse {
    worktree_id: String,
    path: String,
    old_path: Option<String>,
    content: String,
    truncated: bool,
    binary: bool,
    too_large: bool,
}

#[derive(Default)]
struct WatchState {
    running: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

fn safe_git(cwd: &Path, args: &[&str]) -> Result<Vec<u8>, String> {
    let mut child = Command::new("git")
        .args(["-c", "core.hooksPath=/dev/null", "-c", "diff.external="])
        .args(args)
        .current_dir(cwd)
        .env("GIT_OPTIONAL_LOCKS", "0")
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .env("GIT_EXTERNAL_DIFF", "")
        .env("GIT_DIFF_OPTS", "")
        .env("GIT_PAGER", "cat")
        .env("GIT_ATTR_NOSYSTEM", "1")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Could not start Git: {e}"))?;
    let mut stdout = child.stdout.take().ok_or("Git stdout was not captured")?;
    let mut stderr = child.stderr.take().ok_or("Git stderr was not captured")?;
    let stdout_reader = thread::spawn(move || {
        let mut bytes = Vec::new();
        let mut chunk = [0u8; 8192];
        let mut overflow = false;
        loop {
            let count = stdout.read(&mut chunk).map_err(|e| e.to_string())?;
            if count == 0 {
                break;
            }
            let remaining = MAX_GIT_OUTPUT_BYTES.saturating_sub(bytes.len());
            bytes.extend_from_slice(&chunk[..count.min(remaining)]);
            overflow |= count > remaining;
        }
        Ok::<_, String>((bytes, overflow))
    });
    let stderr_reader = thread::spawn(move || {
        let mut bytes = Vec::new();
        let mut chunk = [0u8; 4096];
        loop {
            let count = stderr.read(&mut chunk).map_err(|e| e.to_string())?;
            if count == 0 {
                break;
            }
            let remaining = 256_000usize.saturating_sub(bytes.len());
            bytes.extend_from_slice(&chunk[..count.min(remaining)]);
        }
        Ok::<_, String>(bytes)
    });
    let start = Instant::now();
    loop {
        if child.try_wait().map_err(|e| e.to_string())?.is_some() {
            break;
        }
        if start.elapsed() > GIT_TIMEOUT {
            let _ = child.kill();
            let _ = child.wait();
            let _ = stdout_reader.join();
            let _ = stderr_reader.join();
            return Err("Git command exceeded the 20-second safety limit".into());
        }
        thread::sleep(Duration::from_millis(10));
    }
    let status = child.wait().map_err(|e| e.to_string())?;
    let (stdout, overflow) = stdout_reader
        .join()
        .map_err(|_| "Git output reader panicked")??;
    let stderr = stderr_reader
        .join()
        .map_err(|_| "Git error reader panicked")??;
    if overflow {
        return Err("Git output exceeded the 16 MB safety limit".into());
    }
    if !status.success() {
        return Err(String::from_utf8_lossy(&stderr).trim().to_string());
    }
    Ok(stdout)
}

fn git_text(cwd: &Path, args: &[&str]) -> Result<String, String> {
    safe_git(cwd, args).map(|bytes| String::from_utf8_lossy(&bytes).trim().to_string())
}

fn nul_fields(bytes: &[u8]) -> Vec<String> {
    bytes
        .split(|b| *b == 0)
        .filter(|s| !s.is_empty())
        .map(|s| String::from_utf8_lossy(s).into_owned())
        .collect()
}

fn worktree_records(raw: &[u8]) -> Vec<HashMap<String, String>> {
    let mut records = Vec::new();
    let mut current = HashMap::new();
    let fields = nul_fields(raw);
    let mut iter = fields.into_iter();
    while let Some(field) = iter.next() {
        if field.is_empty() {
            if !current.is_empty() {
                records.push(std::mem::take(&mut current));
            }
            continue;
        }
        let (key, value) = field.split_once(' ').unwrap_or((&field, ""));
        if key == "worktree" {
            if !current.is_empty() {
                records.push(std::mem::take(&mut current));
            }
            current.insert(key.into(), value.into());
            continue;
        }
        if key == "branch" || key == "HEAD" {
            current.insert(key.into(), value.into());
        } else if key == "detached" || key == "bare" || key == "locked" || key == "prunable" {
            current.insert(key.into(), "true".into());
        }
    }
    if !current.is_empty() {
        records.push(current);
    }
    records
}

fn parse_status(
    cwd: &Path,
    worktree_id: &str,
    base: Option<&str>,
) -> Result<Vec<WorktreeFile>, String> {
    let raw = safe_git(
        cwd,
        &[
            "status",
            "--porcelain=v1",
            "-z",
            "--untracked-files=all",
            "--renames",
        ],
    )?;
    let entries = nul_fields(&raw);
    let mut files = Vec::new();
    let mut i = 0;
    while i < entries.len() && files.len() < MAX_FILES {
        let entry = &entries[i];
        let bytes = entry.as_bytes();
        if bytes.len() < 4 {
            i += 1;
            continue;
        }
        let x = bytes[0] as char;
        let y = bytes[1] as char;
        let path = entry[3..].to_string();
        let old = if x == 'R' || x == 'C' || y == 'R' || y == 'C' {
            i += 1;
            if i < entries.len() {
                Some(entries[i].clone())
            } else {
                None
            }
        } else {
            None
        };
        let staged = x != ' ' && x != '?';
        let untracked = x == '?' && y == '?';
        let unstaged = y != ' ' && !untracked;
        let status = if untracked {
            "untracked"
        } else if x == 'D' || y == 'D' {
            "deleted"
        } else if x == 'R' || y == 'R' {
            "renamed"
        } else if x == 'A' || y == 'A' {
            "added"
        } else if x == 'U' || y == 'U' {
            "unmerged"
        } else {
            "modified"
        };
        files.push(WorktreeFile {
            id: format!("{worktree_id}::{path}"),
            path,
            old_path: old,
            status: status.into(),
            staged,
            unstaged,
            untracked,
            committed: false,
        });
        i += 1;
    }
    if let Some(base_ref) = base {
        let raw = safe_git(
            cwd,
            &[
                "diff",
                "--name-status",
                "-z",
                "--find-renames",
                base_ref,
                "HEAD",
                "--",
            ],
        )?;
        let fields = nul_fields(&raw);
        let mut j = 0;
        while j < fields.len() && files.len() < MAX_FILES {
            let status = fields[j].clone();
            j += 1;
            if j >= fields.len() {
                break;
            }
            let (old, path) = if status.starts_with('R') || status.starts_with('C') {
                let old = fields[j].clone();
                j += 1;
                let new = fields.get(j).cloned().unwrap_or_default();
                j += 1;
                (Some(old), new)
            } else {
                let path = fields[j].clone();
                j += 1;
                (None, path)
            };
            let id = format!("{worktree_id}::{path}");
            if let Some(existing) = files.iter_mut().find(|f| f.path == path) {
                existing.committed = true;
                if old.is_some() {
                    existing.old_path = old;
                }
            } else {
                files.push(WorktreeFile {
                    id,
                    path,
                    old_path: old,
                    status: status.chars().next().unwrap_or('M').to_string(),
                    staged: false,
                    unstaged: false,
                    untracked: false,
                    committed: true,
                });
            }
        }
    }
    Ok(files)
}

fn scan_repository(root: &Path) -> Result<RepositorySnapshot, String> {
    let root = root
        .canonicalize()
        .map_err(|e| format!("Invalid repository path: {e}"))?;
    let raw = safe_git(&root, &["worktree", "list", "--porcelain", "-z"])?;
    let records = worktree_records(&raw);
    if records.is_empty() {
        return Err("No Git worktrees were found".into());
    }
    let main_path = records
        .first()
        .and_then(|r| r.get("worktree"))
        .cloned()
        .unwrap_or_default();
    let mut worktrees = Vec::new();
    for record in records.into_iter().take(64) {
        let Some(path) = record.get("worktree") else {
            continue;
        };
        let wt_path = PathBuf::from(path);
        let head = record.get("HEAD").cloned().unwrap_or_default();
        let detached = record.contains_key("detached");
        let branch = record
            .get("branch")
            .map(|b| b.strip_prefix("refs/heads/").unwrap_or(b).to_string());
        let id = wt_path
            .canonicalize()
            .unwrap_or(wt_path.clone())
            .to_string_lossy()
            .into_owned();
        let base_result = {
            let upstream = git_text(
                &wt_path,
                &[
                    "rev-parse",
                    "--abbrev-ref",
                    "--symbolic-full-name",
                    "@{upstream}",
                ],
            );
            let remote_head = git_text(&wt_path, &["symbolic-ref", "refs/remotes/origin/HEAD"]);
            let target = upstream.ok().or_else(|| remote_head.ok()).or_else(|| {
                ["main", "master"]
                    .into_iter()
                    .find(|name| {
                        git_text(
                            &wt_path,
                            &[
                                "show-ref",
                                "--verify",
                                "--quiet",
                                &format!("refs/heads/{name}"),
                            ],
                        )
                        .is_ok()
                    })
                    .map(str::to_string)
            });
            if let Some(target) = target {
                git_text(&wt_path, &["merge-base", "HEAD", &target])
            } else if branch.is_some() {
                git_text(&wt_path, &["rev-parse", "HEAD^"])
            } else {
                Err("Detached HEAD: no comparison base selected".into())
            }
        };
        let (base, base_error) = match base_result {
            Ok(v) if !v.is_empty() => (Some(v), None),
            _ => (
                None,
                Some(
                    if detached {
                        "Detached HEAD: no comparison base selected"
                    } else {
                        "No merge base found; committed changes are unavailable"
                    }
                    .into(),
                ),
            ),
        };
        let mut files = parse_status(&wt_path, &id, base.as_deref())?;
        for file in &mut files {
            let _ = file;
        }
        let unique_paths = files
            .iter()
            .map(|f| &f.path)
            .collect::<std::collections::HashSet<_>>()
            .len();
        let staged_count = files.iter().filter(|f| f.staged).count();
        let unstaged_count = files.iter().filter(|f| f.unstaged).count();
        let untracked_count = files.iter().filter(|f| f.untracked).count();
        let committed_count = files.iter().filter(|f| f.committed).count();
        worktrees.push(Worktree {
            id,
            path: path.clone(),
            branch,
            head,
            detached,
            is_main: *path == main_path,
            base,
            base_error,
            worktree_file_changes: files.len(),
            unique_paths,
            staged_count,
            unstaged_count,
            untracked_count,
            committed_count,
            files,
        });
    }
    Ok(RepositorySnapshot {
        root: root.to_string_lossy().into_owned(),
        worktrees,
        scanned_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64,
    })
}

#[tauri::command]
fn open_repository(path: String) -> Result<RepositorySnapshot, String> {
    scan_repository(Path::new(&path))
}

#[tauri::command]
fn refresh_repository(path: String) -> Result<RepositorySnapshot, String> {
    scan_repository(Path::new(&path))
}

#[tauri::command]
fn get_file_diff(
    worktree_path: String,
    worktree_id: String,
    path: String,
    old_path: Option<String>,
    mode: String,
    base: Option<String>,
) -> Result<DiffResponse, String> {
    if path.starts_with('/') || path.split('/').any(|p| p == "..") {
        return Err("Unsafe repository-relative file path".into());
    }
    let root = PathBuf::from(&worktree_path)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let candidate = root.join(&path);
    if let Ok(metadata) = candidate.metadata() {
        if metadata.len() > MAX_FILE_BYTES {
            return Ok(DiffResponse {
                worktree_id,
                path,
                old_path,
                content: "File exceeds the 2 MB display limit.".into(),
                truncated: false,
                binary: false,
                too_large: true,
            });
        }
    }
    let in_worktree = candidate
        .canonicalize()
        .map(|p| p.starts_with(&root))
        .unwrap_or(false);
    let status = safe_git(
        &root,
        &[
            "status",
            "--porcelain=v1",
            "-z",
            "--untracked-files=all",
            "--",
            &path,
        ],
    )?;
    let is_untracked = status.windows(2).any(|w| w == b"??");
    let mut output = Vec::new();
    let mut args: Vec<String> = match mode.as_str() {
        "working" => {
            let staged = [
                "diff",
                "--cached",
                "--no-ext-diff",
                "--no-textconv",
                "--no-color",
                "--find-renames",
                "--unified=3",
                "--",
                path.as_str(),
            ];
            let mut staged_args = staged.to_vec();
            if let Some(old) = old_path.as_ref() {
                staged_args.push(old);
            }
            output.extend(safe_git(&root, &staged_args)?);
            vec![
                "diff".into(),
                "--no-ext-diff".into(),
                "--no-textconv".into(),
                "--no-color".into(),
                "--find-renames".into(),
                "--unified=3".into(),
                "--".into(),
                path.clone(),
            ]
        }
        "staged" => vec![
            "diff".into(),
            "--cached".into(),
            "--no-ext-diff".into(),
            "--no-textconv".into(),
            "--no-color".into(),
            "--find-renames".into(),
            "--unified=3".into(),
            "--".into(),
            path.clone(),
        ],
        "total" => {
            let b = base.ok_or("No merge base is available for this worktree")?;
            vec![
                "diff".into(),
                "--no-ext-diff".into(),
                "--no-textconv".into(),
                "--no-color".into(),
                "--find-renames".into(),
                "--unified=3".into(),
                b,
                "--".into(),
                path.clone(),
            ]
        }
        _ => return Err("Unsupported diff mode".into()),
    };
    if let Some(old) = old_path.as_ref() {
        if !args.iter().any(|arg| arg == old) {
            args.push(old.clone());
        }
    }
    let argv = args.iter().map(String::as_str).collect::<Vec<_>>();
    output.extend(safe_git(&root, &argv)?);
    let mut untracked_binary = false;
    if mode != "staged" && is_untracked && in_worktree {
        let bytes = std::fs::read(&candidate).map_err(|e| e.to_string())?;
        if bytes.len() as u64 > MAX_FILE_BYTES {
            return Ok(DiffResponse {
                worktree_id,
                path,
                old_path,
                content: "File exceeds the 2 MB display limit.".into(),
                truncated: false,
                binary: false,
                too_large: true,
            });
        }
        untracked_binary = std::str::from_utf8(&bytes).is_err() || bytes.contains(&0);
        let body = String::from_utf8_lossy(&bytes);
        output.extend(format!("diff --git a/{path} b/{path}\nnew file mode 100644\n--- /dev/null\n+++ b/{path}\n@@ -0,0 +1,{} @@\n", body.lines().count()).bytes());
        for line in body.lines() {
            output.extend(format!("+{line}\n").bytes());
        }
    }
    let binary = untracked_binary || output.windows(7).any(|w| w == b"Binary ");
    let truncated = output.len() > MAX_DIFF_BYTES;
    let content = String::from_utf8_lossy(&output[..output.len().min(MAX_DIFF_BYTES)]).into_owned();
    Ok(DiffResponse {
        worktree_id,
        path,
        old_path,
        content,
        truncated,
        binary,
        too_large: false,
    })
}

#[tauri::command]
fn watch_repository(
    app: AppHandle,
    state: State<'_, WatchState>,
    path: String,
) -> Result<(), String> {
    stop_watch_inner(&state, &path);
    scan_repository(Path::new(&path))?;
    let (sender, receiver) = mpsc::sync_channel::<()>(32);
    let stop = Arc::new(AtomicBool::new(false));
    let stopped = stop.clone();
    let root = path.clone();
    thread::spawn(move || {
        let mut watchers: Vec<(String, RecommendedWatcher)> = Vec::new();
        let mut last_signature = String::new();
        while !stopped.load(Ordering::Relaxed) {
            let event_received = receiver.recv_timeout(Duration::from_secs(2)).is_ok();
            if event_received {
                thread::sleep(Duration::from_millis(350));
                while receiver.try_recv().is_ok() {}
            }
            if stopped.load(Ordering::Relaxed) {
                break;
            }
            let Ok(snapshot) = scan_repository(Path::new(&root)) else {
                continue;
            };
            let active = snapshot
                .worktrees
                .iter()
                .take(64)
                .map(|worktree| worktree.id.clone())
                .collect::<std::collections::HashSet<_>>();
            watchers.retain(|(id, _)| active.contains(id));
            for worktree in snapshot.worktrees.iter().take(64) {
                if !watchers.iter().any(|(id, _)| id == &worktree.id) {
                    if let Ok(watcher) = make_watcher(&worktree.path, sender.clone()) {
                        watchers.push((worktree.id.clone(), watcher));
                    }
                }
            }
            let signature = serde_json::to_string(&snapshot.worktrees).unwrap_or_default();
            if event_received || signature != last_signature {
                let _ = app.emit("repository-changed", snapshot);
                last_signature = signature;
            }
        }
    });
    state
        .running
        .lock()
        .map_err(|e| e.to_string())?
        .insert(path, stop);
    Ok(())
}

fn make_watcher(path: &str, sender: mpsc::SyncSender<()>) -> Result<RecommendedWatcher, String> {
    let mut watcher = RecommendedWatcher::new(
        move |_event| {
            let _ = sender.try_send(());
        },
        Config::default(),
    )
    .map_err(|e| e.to_string())?;
    watcher
        .watch(Path::new(path), RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;
    Ok(watcher)
}

#[tauri::command]
fn stop_watch(state: State<'_, WatchState>, path: String) {
    stop_watch_inner(&state, &path);
}

fn stop_watch_inner(state: &WatchState, path: &str) {
    if let Ok(mut running) = state.running.lock() {
        if let Some(stop) = running.remove(path) {
            stop.store(true, Ordering::Relaxed);
        }
    }
}

#[tauri::command]
fn reveal_path(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg("-R")
            .arg(path)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg("/select,")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        let parent = Path::new(&path).parent().ok_or("Path has no parent")?;
        Command::new("xdg-open")
            .arg(parent)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .manage(WatchState::default())
        .invoke_handler(tauri::generate_handler![
            open_repository,
            refresh_repository,
            get_file_diff,
            watch_repository,
            stop_watch,
            reveal_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running Diffscape");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{fs, process::Command, time::SystemTime};

    fn run_git(path: &Path, args: &[&str]) {
        let output = Command::new("git")
            .args(args)
            .current_dir(path)
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
    }

    fn temp_root() -> PathBuf {
        let path = std::env::temp_dir().join(format!(
            "diffscape-test-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&path).unwrap();
        path
    }

    #[test]
    fn parses_nul_delimited_worktree_paths() {
        let parsed = worktree_records(b"worktree /tmp/repo\0HEAD abc\0branch refs/heads/main\0\0worktree /tmp/linked worktree\0HEAD def\0detached\0\0");
        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[1].get("worktree").unwrap(), "/tmp/linked worktree");
        assert!(parsed[1].contains_key("detached"));
    }

    #[test]
    fn discovers_linked_worktrees_and_counts_each_change_state_read_only() {
        let temp = temp_root();
        let repo = temp.join("checkout");
        let linked = temp.join("linked worktree");
        fs::create_dir_all(&repo).unwrap();
        run_git(&repo, &["init", "-b", "main"]);
        fs::write(repo.join("shared.txt"), "base\n").unwrap();
        fs::write(repo.join("rename-before.txt"), "keep this renamed file\n").unwrap();
        run_git(&repo, &["add", "shared.txt"]);
        run_git(&repo, &["add", "rename-before.txt"]);
        run_git(
            &repo,
            &[
                "-c",
                "user.name=Diffscape Test",
                "-c",
                "user.email=test@example.invalid",
                "commit",
                "-m",
                "base",
            ],
        );
        run_git(
            &repo,
            &[
                "worktree",
                "add",
                "-b",
                "feature",
                linked.to_str().unwrap(),
                "main",
            ],
        );
        run_git(&repo, &["mv", "rename-before.txt", "rename-after.txt"]);
        fs::write(repo.join("shared.txt"), "main working edit\n").unwrap();
        fs::write(repo.join("staged.txt"), "staged addition\n").unwrap();
        run_git(&repo, &["add", "staged.txt"]);
        fs::write(repo.join("new.txt"), "untracked content\n").unwrap();
        fs::write(linked.join("shared.txt"), "feature committed content\n").unwrap();
        run_git(&linked, &["add", "shared.txt"]);
        run_git(
            &linked,
            &[
                "-c",
                "user.name=Diffscape Test",
                "-c",
                "user.email=test@example.invalid",
                "commit",
                "-m",
                "feature change",
            ],
        );
        fs::write(linked.join("shared.txt"), "feature working edit\n").unwrap();

        let index_before = fs::read(repo.join(".git/index")).unwrap();
        let snapshot = scan_repository(&repo).unwrap();
        assert_eq!(snapshot.worktrees.len(), 2);
        let linked_canonical = linked.canonicalize().unwrap();
        assert!(
            snapshot
                .worktrees
                .iter()
                .any(|worktree| worktree.path == linked_canonical.to_string_lossy()),
            "paths: {:?}; expected: {}",
            snapshot
                .worktrees
                .iter()
                .map(|worktree| &worktree.path)
                .collect::<Vec<_>>(),
            linked_canonical.display()
        );
        let main = snapshot
            .worktrees
            .iter()
            .find(|worktree| worktree.branch.as_deref() == Some("main"))
            .unwrap();
        let feature = snapshot
            .worktrees
            .iter()
            .find(|worktree| worktree.branch.as_deref() == Some("feature"))
            .unwrap();
        assert_eq!(
            (main.staged_count, main.unstaged_count, main.untracked_count),
            (2, 1, 1)
        );
        let rename = main
            .files
            .iter()
            .find(|file| file.path == "rename-after.txt")
            .unwrap();
        assert_eq!(rename.old_path.as_deref(), Some("rename-before.txt"));
        assert_eq!((feature.committed_count, feature.unstaged_count), (1, 1));
        assert_eq!(
            fs::read(repo.join(".git/index")).unwrap(),
            index_before,
            "scans must not rewrite the index"
        );

        let total = get_file_diff(
            linked.to_string_lossy().into_owned(),
            feature.id.clone(),
            "shared.txt".into(),
            None,
            "total".into(),
            feature.base.clone(),
        )
        .unwrap();
        assert!(total.content.contains("feature working edit"));
        let working = get_file_diff(
            repo.to_string_lossy().into_owned(),
            main.id.clone(),
            "new.txt".into(),
            None,
            "working".into(),
            main.base.clone(),
        )
        .unwrap();
        assert!(working.content.contains("+untracked content"));
        fs::write(repo.join("naïve-文件.txt"), "Unicode content\n").unwrap();
        let unicode = get_file_diff(
            repo.to_string_lossy().into_owned(),
            main.id.clone(),
            "naïve-文件.txt".into(),
            None,
            "working".into(),
            main.base.clone(),
        )
        .unwrap();
        assert!(unicode.content.contains("+Unicode content"));
        fs::write(repo.join("binary.dat"), [0u8, 1, 2, 3]).unwrap();
        let binary = get_file_diff(
            repo.to_string_lossy().into_owned(),
            main.id.clone(),
            "binary.dat".into(),
            None,
            "working".into(),
            main.base.clone(),
        )
        .unwrap();
        assert!(binary.binary);
        fs::write(
            repo.join("oversized.dat"),
            vec![b'x'; MAX_FILE_BYTES as usize + 1],
        )
        .unwrap();
        let large = get_file_diff(
            repo.to_string_lossy().into_owned(),
            main.id.clone(),
            "oversized.dat".into(),
            None,
            "working".into(),
            main.base.clone(),
        )
        .unwrap();
        assert!(large.too_large);
        assert_eq!(
            fs::read(repo.join(".git/index")).unwrap(),
            index_before,
            "diff reads must not rewrite the index"
        );
        fs::remove_dir_all(temp).unwrap();
    }
}
