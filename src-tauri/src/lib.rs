use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};

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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_vibrancy")]
    pub vibrancy: bool,
    #[serde(default = "default_vibrancy_opacity")]
    pub vibrancy_opacity: f64,
    #[serde(default = "default_vibrancy_blur")]
    pub vibrancy_blur: f64,
    #[serde(default)]
    pub onboarded: bool,
}

fn default_theme() -> String {
    "dark".to_string()
}

fn default_vibrancy() -> bool {
    true
}

fn default_vibrancy_opacity() -> f64 {
    0.15
}

fn default_vibrancy_blur() -> f64 {
    40.0
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: default_theme(),
            vibrancy: default_vibrancy(),
            vibrancy_opacity: default_vibrancy_opacity(),
            vibrancy_blur: default_vibrancy_blur(),
            onboarded: false,
        }
    }
}

fn get_settings_path(app: &tauri::AppHandle) -> PathBuf {
    let app_data = app.path().app_data_dir().expect("failed to get app data dir");
    fs::create_dir_all(&app_data).ok();
    app_data.join("settings.json")
}

#[tauri::command]
fn load_settings(app: tauri::AppHandle) -> AppSettings {
    let path = get_settings_path(&app);
    if path.exists() {
        let data = fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        AppSettings::default()
    }
}

#[tauri::command]
fn save_settings(app: tauri::AppHandle, settings: AppSettings) {
    let path = get_settings_path(&app);
    let data = serde_json::to_string_pretty(&settings).unwrap_or_default();
    fs::write(path, data).ok();
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
        .setup(|app| {
            // Build macOS-style app menu
            let settings_item = MenuItem::with_id(app, "settings", "Settings…", true, Some("CmdOrCtrl+,"))?;
            let separator = PredefinedMenuItem::separator(app)?;
            let quit = PredefinedMenuItem::quit(app, Some("Quit Flow"))?;
            let hide = PredefinedMenuItem::hide(app, Some("Hide Flow"))?;
            let show_all = PredefinedMenuItem::show_all(app, Some("Show All"))?;

            let app_menu = Submenu::with_items(app, "Flow", true, &[
                &settings_item,
                &separator,
                &hide,
                &show_all,
                &PredefinedMenuItem::separator(app)?,
                &quit,
            ])?;

            let edit_menu = Submenu::with_items(app, "Edit", true, &[
                &PredefinedMenuItem::undo(app, None)?,
                &PredefinedMenuItem::redo(app, None)?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::cut(app, None)?,
                &PredefinedMenuItem::copy(app, None)?,
                &PredefinedMenuItem::paste(app, None)?,
                &PredefinedMenuItem::select_all(app, None)?,
            ])?;

            let menu = Menu::with_items(app, &[&app_menu, &edit_menu])?;
            app.set_menu(menu)?;

            // Listen for settings menu click
            app.on_menu_event(move |app_handle, event| {
                if event.id() == "settings" {
                    if let Some(window) = app_handle.get_webview_window("main") {
                        window.eval("window.__openSettings?.()").ok();
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_notes,
            save_note,
            load_note,
            delete_note,
            load_settings,
            save_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
