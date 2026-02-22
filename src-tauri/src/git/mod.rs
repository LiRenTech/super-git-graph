use git2::{Repository, Oid, Sort, StatusOptions};
use serde::Serialize;
use std::path::Path;

#[derive(Serialize)]
pub struct GitCommit {
    id: String,
    message: String,
    author: String,
    date: i64,
    parents: Vec<String>,
    refs: Vec<String>,
}

#[tauri::command]
pub fn get_commits(repo_path: String, limit: usize) -> Result<Vec<GitCommit>, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let mut walk = repo.revwalk().map_err(|e| e.to_string())?;
    
    walk.set_sorting(Sort::TOPOLOGICAL | Sort::TIME).map_err(|e| e.to_string())?;
    walk.push_head().map_err(|e| e.to_string())?;

    let mut commits = Vec::new();
    let mut count = 0;

    // Check for uncommitted changes
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

    for oid in walk {
        if count >= limit {
            break;
        }
        
        let oid = oid.map_err(|e| e.to_string())?;
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

    Ok(commits)
}
