use std::process::Command;
use tauri::{AppHandle, Manager, Runtime};

mod git;

#[tauri::command]
fn reveal_store_file<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("layout-cache.json");

    #[cfg(target_os = "macos")]
    Command::new("open")
        .arg("-R")
        .arg(path)
        .spawn()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    Command::new("explorer")
        .arg("/select,")
        .arg(path)
        .spawn()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "linux")]
    // Linux doesn't have a standard reveal command, just open the dir
    Command::new("xdg-open")
        .arg(path.parent().unwrap())
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            git::get_commits,
            git::get_all_refs,
            git::get_diff,
            git::checkout_commit,
            git::checkout_branch,
            git::pull_branch,
            git::push_branch,
            reveal_store_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}