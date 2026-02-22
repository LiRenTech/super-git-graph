use git2::Repository;
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
pub struct GitCommit {
    pub id: String,
    pub message: String,
    pub author: String,
    pub date: i64,
    pub parents: Vec<String>,
    pub refs: Vec<String>, // Tags, branches, HEAD, etc.
}

#[tauri::command]
pub fn get_commits(repo_path: String, limit: Option<usize>) -> Result<Vec<GitCommit>, String> {
    let repo = Repository::open(Path::new(&repo_path)).map_err(|e| e.to_string())?;

    // Collect references (branches, tags, HEAD)
    let mut refs_map = std::collections::HashMap::new();

    // Add HEAD
    if let Ok(head) = repo.head() {
        if let Some(target) = head.target() {
            refs_map
                .entry(target.to_string())
                .or_insert(Vec::new())
                .push("HEAD".to_string());
        }
    }

    // Add branches
    if let Ok(branches) = repo.branches(None) {
        for branch in branches {
            if let Ok((branch, _)) = branch {
                if let (Some(name), Some(target)) =
                    (branch.name().ok().flatten(), branch.get().target())
                {
                    refs_map
                        .entry(target.to_string())
                        .or_insert(Vec::new())
                        .push(name.to_string());
                }
            }
        }
    }

    // Add tags
    if let Ok(tags) = repo.tag_names(None) {
        for tag_name in tags.iter().flatten() {
            if let Ok(obj) = repo.revparse_single(tag_name) {
                // For annotated tags, we need the target commit
                let commit_id = if let Some(tag) = obj.as_tag() {
                    tag.target_id().to_string()
                } else {
                    obj.id().to_string()
                };
                refs_map
                    .entry(commit_id)
                    .or_insert(Vec::new())
                    .push(tag_name.to_string());
            }
        }
    }

    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    revwalk.push_head().map_err(|e| e.to_string())?;
    revwalk
        .set_sorting(git2::Sort::TIME)
        .map_err(|e| e.to_string())?;

    let mut commits = Vec::new();
    let limit_val = limit.unwrap_or(100);

    for (i, oid) in revwalk.enumerate() {
        if i >= limit_val {
            break;
        }

        let oid = oid.map_err(|e| e.to_string())?;
        let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;
        let id_str = commit.id().to_string();

        commits.push(GitCommit {
            id: id_str.clone(),
            message: commit.message().unwrap_or("").to_string(),
            author: commit.author().name().unwrap_or("Unknown").to_string(),
            date: commit.time().seconds(),
            parents: commit.parent_ids().map(|id| id.to_string()).collect(),
            refs: refs_map.remove(&id_str).unwrap_or_default(),
        });
    }

    Ok(commits)
}
