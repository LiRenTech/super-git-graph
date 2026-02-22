use git2::{Repository, Oid, Sort, StatusOptions};
use serde::Serialize;
use std::path::Path;
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

#[tauri::command]
pub fn get_commits(repo_path: String, limit: usize, skip: Option<usize>) -> Result<CommitResponse, String> {
    let skip = skip.unwrap_or(0);
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let mut walk = repo.revwalk().map_err(|e| e.to_string())?;
    
    walk.set_sorting(Sort::TOPOLOGICAL | Sort::TIME).map_err(|e| e.to_string())?;
    walk.push_head().map_err(|e| e.to_string())?;

    // Handle Stashes
    let mut stash_map = HashMap::new();
    if let Ok(reflog) = repo.reflog("refs/stash") {
        for (i, entry) in reflog.iter().enumerate() {
            let id = entry.id_new();
            if let Ok(_) = walk.push(id) {
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
            let head_oid = head.as_ref().and_then(|h| h.target()).map(|oid| oid.to_string());
            
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
                            if name == "HEAD" { continue; }

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

    Ok(CommitResponse {
        commits,
        has_more,
    })
}
