use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteMeta {
    pub id: String,
    pub title: String,
    pub created_at: u64,
    pub updated_at: u64,
    pub preview: String,
    #[serde(default = "default_mode")]
    pub mode: String,
    #[serde(default)]
    pub pinned: bool,
}

fn default_mode() -> String {
    "page".to_string()
}

fn get_notes_dir(app: &tauri::AppHandle) -> PathBuf {
    let app_data = app.path().app_data_dir().expect("failed to get app data dir");
    let notes_dir = app_data.join("notes");
    fs::create_dir_all(&notes_dir).ok();
    notes_dir
}

fn get_index_path(app: &tauri::AppHandle) -> PathBuf {
    let app_data = app.path().app_data_dir().expect("failed to get app data dir");
    fs::create_dir_all(&app_data).ok();
    app_data.join("notes-index.json")
}

fn read_index(app: &tauri::AppHandle) -> Vec<NoteMeta> {
    let path = get_index_path(app);
    if path.exists() {
        let data = fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        vec![]
    }
}

fn write_index(app: &tauri::AppHandle, notes: &[NoteMeta]) {
    let path = get_index_path(app);
    let data = serde_json::to_string_pretty(notes).unwrap_or_default();
    fs::write(path, data).ok();
}

#[tauri::command]
fn list_notes(app: tauri::AppHandle) -> Vec<NoteMeta> {
    read_index(&app)
}

#[tauri::command]
fn save_note(app: tauri::AppHandle, id: String, title: String, preview: String, mode: String, pinned: bool, data: Vec<u8>) {
    let notes_dir = get_notes_dir(&app);
    let note_path = notes_dir.join(format!("{}.bin", id));
    fs::write(note_path, &data).ok();

    let mut notes = read_index(&app);
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;

    if let Some(existing) = notes.iter_mut().find(|n| n.id == id) {
        existing.title = title;
        existing.preview = preview;
        existing.mode = mode;
        existing.pinned = pinned;
        existing.updated_at = now;
    } else {
        notes.push(NoteMeta {
            id,
            title,
            preview,
            mode,
            pinned,
            created_at: now,
            updated_at: now,
        });
    }

    write_index(&app, &notes);
}

#[tauri::command]
fn load_note(app: tauri::AppHandle, id: String) -> Option<Vec<u8>> {
    let notes_dir = get_notes_dir(&app);
    let note_path = notes_dir.join(format!("{}.bin", id));
    fs::read(note_path).ok()
}

#[tauri::command]
fn delete_note(app: tauri::AppHandle, id: String) {
    let notes_dir = get_notes_dir(&app);
    let note_path = notes_dir.join(format!("{}.bin", id));
    fs::remove_file(note_path).ok();

    let mut notes = read_index(&app);
    notes.retain(|n| n.id != id);
    write_index(&app, &notes);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            list_notes,
            save_note,
            load_note,
            delete_note,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
