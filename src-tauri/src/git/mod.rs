use git2::{Oid, Repository, Sort, StatusOptions, ObjectType};
use serde::Serialize;
use std::collections::HashMap;

#[derive(Serialize)]
pub struct GitCommit {
    id: String,
    message: String,
    author: String,
    date: i64,
    parents: Vec<String>,
    refs: Vec<String>,
}

#[derive(Serialize)]
pub struct CommitResponse {
    commits: Vec<GitCommit>,
    has_more: bool,
}

#[derive(Serialize)]
pub struct GitRef {
    pub name: String,
    pub commit_id: String,
}

#[derive(Serialize)]
pub struct FileDiff {
    path: String,
    old_content: String,
    new_content: String,
}

#[derive(Serialize)]
pub struct DiffResponse {
    files: Vec<FileDiff>,
}

#[tauri::command]
pub fn get_all_refs(repo_path: String) -> Result<Vec<GitRef>, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let mut refs = Vec::new();

    if let Ok(repo_refs) = repo.references() {
        for r in repo_refs {
            if let Ok(r) = r {
                if let Some(name) = r.name() {
                    if let Some(target) = r.target() {
                        let short_name = if name.starts_with("refs/heads/") {
                            name.replace("refs/heads/", "")
                        } else if name.starts_with("refs/remotes/") {
                            name.replace("refs/remotes/", "")
                        } else {
                            name.to_string()
                        };

                        refs.push(GitRef {
                            name: short_name,
                            commit_id: target.to_string(),
                        });
                    }
                }
            }
        }
    }

    Ok(refs)
}

#[tauri::command]
pub fn get_commits(
    repo_path: String,
    limit: usize,
    skip: Option<usize>,
) -> Result<CommitResponse, String> {
    let skip = skip.unwrap_or(0);
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let mut walk = repo.revwalk().map_err(|e| e.to_string())?;

    walk.set_sorting(Sort::TOPOLOGICAL | Sort::TIME)
        .map_err(|e| e.to_string())?;
    walk.push_head().map_err(|e| e.to_string())?;

    // Handle Stashes
    let mut stash_map = HashMap::new();
    if let Ok(reflog) = repo.reflog("refs/stash") {
        for (i, entry) in reflog.iter().enumerate() {
            let id = entry.id_new();
            if let Ok(_) = walk.push(id) {
                // Only add if it's not a parent-less stash commit (like index/untracked sometimes)
                // Actually, standard git stash list shows these.
                // But user wants to hide "index on master" or "untracked files" if they are redundant or problematic.
                // Stash usually creates 2 or 3 commits.
                // The main stash commit (refs/stash) is a merge commit of the index and the working tree (and untracked).
                // We usually only care about the top-level stash commit.
                // However, `walk.push(id)` adds the commit to the traversal.
                // If we want to filter, we should check the message or structure.

                // Let's filter out "index on ..." and "untracked files on ..." if they appear as separate roots or noise?
                // The issue user describes is "index on master" and "untracked files on master" appearing as separate nodes.
                // In a stash, the Reflog entry points to the Merge Commit (WIP on master ...).
                // The parents of this merge commit are:
                // 1. The HEAD at time of stash.
                // 2. The index commit.
                // 3. (Optional) The untracked files commit.

                // If we just push the reflog ID, we get the main stash commit.
                // But `revwalk` will then traverse its parents.
                // If we want to hide the "implementation detail" commits of a stash (index/untracked),
                // we might need to tell revwalk to HIDE them?
                // Or we can just filter them out in the loop below if they are purely stash artifacts.

                stash_map.insert(id, format!("stash@{{{}}}", i));
            }
        }
    }

    let mut commits = Vec::new();

    // Check for uncommitted changes (only for first page)
    if skip == 0 {
        let mut status_opts = StatusOptions::new();
        status_opts.include_untracked(true);

        let has_changes = repo
            .statuses(Some(&mut status_opts))
            .map(|statuses| !statuses.is_empty())
            .unwrap_or(false);

        if has_changes {
            // Create a virtual "Uncommitted Changes" commit
            // We need to find the current HEAD to set as parent
            let head = repo.head().ok();
            let head_oid = head
                .as_ref()
                .and_then(|h| h.target())
                .map(|oid| oid.to_string());

            if let Some(parent_id) = head_oid {
                commits.push(GitCommit {
                    id: "working-copy".to_string(),
                    message: "Uncommitted Changes".to_string(),
                    author: "You".to_string(),
                    date: chrono::Utc::now().timestamp(),
                    parents: vec![parent_id],
                    refs: vec![],
                });
            }
        }
    }

    // Skip commits
    let mut walk_iter = walk.skip(skip);
    let mut count = 0;

    while count < limit {
        let oid = match walk_iter.next() {
            Some(Ok(oid)) => oid,
            Some(Err(e)) => return Err(e.to_string()),
            None => break,
        };

        let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;

        let message = commit.summary().unwrap_or("").to_string();
        let author = commit.author().name().unwrap_or("").to_string();
        let date = commit.time().seconds();
        let parents = commit.parent_ids().map(|p| p.to_string()).collect();

        // Collect refs
        let mut refs = Vec::new();

        // Check if HEAD points to this commit
        if let Ok(head) = repo.head() {
            if let Some(target) = head.target() {
                if target == oid {
                    refs.push("HEAD".to_string());
                }
            }
        }

        // Get other refs
        if let Ok(repo_refs) = repo.references() {
            for r in repo_refs {
                if let Ok(r) = r {
                    if r.target() == Some(oid) {
                        if let Some(name) = r.name() {
                            // Skip HEAD if we already added it (though repo.references usually doesn't show HEAD if symbolic)
                            if name == "HEAD" {
                                continue;
                            }

                            if name.starts_with("refs/heads/") {
                                refs.push(name.replace("refs/heads/", ""));
                            } else if name.starts_with("refs/remotes/") {
                                refs.push(name.replace("refs/remotes/", ""));
                            } else {
                                // Keep refs/tags/ and others as is for now, frontend handles tags
                                refs.push(name.to_string());
                            }
                        }
                    }
                }
            }
        }

        // Check if this commit is a stash
        if let Some(stash_name) = stash_map.get(&oid) {
            refs.push(stash_name.clone());
        }

        // Check if this commit is a stash artifact we want to hide
        // Stash artifacts usually have messages like "index on ..." or "untracked files on ..."
        // And they are parents of the stash commit.
        // If we want to hide them, we should check if this commit is referenced ONLY by stash parents?
        // Or simpler: filter by message pattern if it's a stash-related commit.
        // Stash messages: "WIP on master: ...", "index on master: ...", "untracked files on master: ..."
        // The user wants to hide "index on ..." and "untracked files on ...".

        let is_stash_artifact =
            message.starts_with("index on ") || message.starts_with("untracked files on ");
        if is_stash_artifact {
            // We skip adding this commit to the list, effectively hiding it from the graph.
            // BUT, if we hide it, we might break the graph connectivity if it was a bridge?
            // For stash, the "WIP" commit connects to HEAD. The "index" and "untracked" connect to HEAD (or are leaf?).
            // "WIP" has parents: HEAD, index, untracked.
            // So if we hide "index" and "untracked", "WIP" will have edges to invisible nodes?
            // Frontend handles invisible parents by just not drawing edge?
            // Or we should remove them from "parents" list of the WIP commit?

            // If we just `continue` here, the WIP commit will still have them in `parents` list.
            // The frontend might try to draw edge to missing node, or just ignore it.
            // Most graph libs ignore edges to missing nodes.
            // So let's try skipping it.
            continue;
        }

        commits.push(GitCommit {
            id: oid.to_string(),
            message,
            author,
            date,
            parents,
            refs,
        });

        count += 1;
    }

    // Check if there are more commits
    let has_more = walk_iter.next().is_some();

    Ok(CommitResponse { commits, has_more })
}

#[tauri::command]
pub fn get_diff(
    repo_path: String,
    old_commit: String,
    new_commit: String,
) -> Result<DiffResponse, String> {
    println!("get_diff called: old={}, new={}", old_commit, new_commit);

    // Validate commit IDs
    if old_commit == "working-copy" || new_commit == "working-copy" {
        return Err("Cannot diff with working-copy. Please select real commits.".to_string());
    }

    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;

    let old_oid = Oid::from_str(&old_commit).map_err(|e| {
        format!("Invalid commit ID '{}': {}", old_commit, e)
    })?;
    let new_oid = Oid::from_str(&new_commit).map_err(|e| {
        format!("Invalid commit ID '{}': {}", new_commit, e)
    })?;

    let old_commit_obj = repo.find_commit(old_oid).map_err(|e| e.to_string())?;
    let new_commit_obj = repo.find_commit(new_oid).map_err(|e| e.to_string())?;

    let old_tree = old_commit_obj.tree().map_err(|e| e.to_string())?;
    let new_tree = new_commit_obj.tree().map_err(|e| e.to_string())?;

    let diff = repo
        .diff_tree_to_tree(Some(&old_tree), Some(&new_tree), None)
        .map_err(|e| e.to_string())?;

    println!("Diff object created, getting deltas...");

    let mut files = Vec::new();

    for delta in diff.deltas() {
        println!("Processing delta");

        // Get the file path from either new_file or old_file
        let file_path = delta.new_file().path()
            .or_else(|| delta.old_file().path())
            .map(|p| {
                let path_str = p.to_string_lossy().to_string();
                println!("Processing file: {}", path_str);
                path_str
            })
            .unwrap_or_else(|| {
                println!("Unknown file path in delta");
                String::from("unknown")
            });

        // Get old content
        let old_content = if let Some(old_path) = delta.old_file().path() {
            println!("Getting old content from: {:?}", old_path);
            get_file_content(&repo, &old_tree, &file_path, Some(old_path))
        } else {
            println!("File was added (no old content)");
            String::new() // File was added
        };

        // Get new content
        let new_content = if let Some(new_path) = delta.new_file().path() {
            println!("Getting new content from: {:?}", new_path);
            get_file_content(&repo, &new_tree, &file_path, Some(new_path))
        } else {
            println!("File was deleted (no new content)");
            String::new() // File was deleted
        };

        files.push(FileDiff {
            path: file_path,
            old_content,
            new_content,
        });
    }

    println!("Returning {} files", files.len());
    Ok(DiffResponse { files })
}

fn get_file_content(
    repo: &Repository,
    tree: &git2::Tree,
    file_path: &str,
    entry_path: Option<&std::path::Path>,
) -> String {
    let path_to_find = entry_path.unwrap_or_else(|| std::path::Path::new(file_path));

    // Try to find the file in the tree
    let tree_entry = match tree.get_path(path_to_find) {
        Ok(entry) => entry,
        Err(e) => {
            eprintln!("Failed to get path {:?} from tree: {}", path_to_find, e);
            return String::new();
        }
    };

    if tree_entry.kind() != Some(ObjectType::Blob) {
        eprintln!("Entry {:?} is not a blob, it's a {:?}", path_to_find, tree_entry.kind());
        return String::new();
    }

    let obj = match repo.find_object(tree_entry.id(), Some(ObjectType::Blob)) {
        Ok(obj) => obj,
        Err(e) => {
            eprintln!("Failed to find object {:?}: {}", tree_entry.id(), e);
            return String::new();
        }
    };

    let blob = obj.as_blob().unwrap();
    String::from_utf8_lossy(blob.content()).to_string()
}
