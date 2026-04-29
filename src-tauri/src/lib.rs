mod search;

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, AtomicUsize, Ordering};
use std::sync::{Mutex, OnceLock};
use tauri::{Emitter, Listener, Manager};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::webview::WebviewWindowBuilder;

static APP_HANDLE: OnceLock<tauri::AppHandle> = OnceLock::new();
static WINDOW_COUNTER: AtomicU32 = AtomicU32::new(2);

#[cfg(target_os = "macos")]
static DOCK_HANDLER_PTR: AtomicUsize = AtomicUsize::new(0);

/// Create a new main application window (multi-window support).
fn create_new_main_window(handle: &tauri::AppHandle) {
    let id = WINDOW_COUNTER.fetch_add(1, Ordering::SeqCst);
    let label = format!("main-{}", id);
    if let Ok(win) = WebviewWindowBuilder::new(
        handle,
        &label,
        tauri::WebviewUrl::App("index.html".into()),
    )
    .title("Untitled")
    .inner_size(1200.0, 800.0)
    .min_inner_size(800.0, 600.0)
    .title_bar_style(tauri::TitleBarStyle::Overlay)
    .hidden_title(true)
    .decorations(false)
    .transparent(true)
    .visible(false)
    .build()
    {
        // Window will be shown by the frontend once the UI is ready
        let _ = win;
    }
}

/// Objective-C callback for the "New Window" dock menu item.
#[cfg(target_os = "macos")]
extern "C" fn handle_new_window(
    _self: *const std::ffi::c_void,
    _cmd: *const std::ffi::c_void,
    _sender: *const std::ffi::c_void,
) {
    if let Some(handle) = APP_HANDLE.get() {
        create_new_main_window(handle);
    }
}

/// Objective-C callback for applicationDockMenu: — builds the dock menu dynamically.
#[cfg(target_os = "macos")]
extern "C" fn dock_menu_imp(
    _self: *const std::ffi::c_void,
    _cmd: *const std::ffi::c_void,
    _app: *const std::ffi::c_void,
) -> *const std::ffi::c_void {
    use std::ffi::c_void;

    extern "C" {
        fn sel_registerName(name: *const i8) -> *const c_void;
        fn objc_msgSend();
        fn objc_getClass(name: *const i8) -> *const c_void;
    }

    unsafe {
        type Msg0 = extern "C" fn(*const c_void, *const c_void) -> *const c_void;
        type Msg1 = extern "C" fn(*const c_void, *const c_void, *const c_void) -> *const c_void;
        type Msg3 = extern "C" fn(*const c_void, *const c_void, *const c_void, *const c_void, *const c_void) -> *const c_void;
        type MsgIdx = extern "C" fn(*const c_void, *const c_void, usize) -> *const c_void;
        type MsgUsize = extern "C" fn(*const c_void, *const c_void) -> usize;
        type MsgBool = extern "C" fn(*const c_void, *const c_void) -> bool;

        let m0: Msg0 = std::mem::transmute(objc_msgSend as *const c_void);
        let m1: Msg1 = std::mem::transmute(objc_msgSend as *const c_void);
        let m3: Msg3 = std::mem::transmute(objc_msgSend as *const c_void);
        let m_idx: MsgIdx = std::mem::transmute(objc_msgSend as *const c_void);
        let m_usize: MsgUsize = std::mem::transmute(objc_msgSend as *const c_void);
        let m_bool: MsgBool = std::mem::transmute(objc_msgSend as *const c_void);

        let sel = |s: &[u8]| sel_registerName(s.as_ptr() as *const i8);
        let cls = |s: &[u8]| objc_getClass(s.as_ptr() as *const i8);

        // [[NSMenu alloc] init]
        let menu = m0(m0(cls(b"NSMenu\0"), sel(b"alloc\0")), sel(b"init\0"));

        // Get NSApp windows
        let ns_app = m0(cls(b"NSApplication\0"), sel(b"sharedApplication\0"));
        let windows = m0(ns_app, sel(b"windows\0"));
        let count = m_usize(windows, sel(b"count\0"));

        // NSString helpers
        let ns_string = cls(b"NSString\0");
        let str_sel = sel(b"stringWithUTF8String:\0");
        let empty_key = m1(ns_string, str_sel, b"\0".as_ptr() as *const c_void);

        let ns_menu_item = cls(b"NSMenuItem\0");
        let alloc_sel = sel(b"alloc\0");
        let init_title_sel = sel(b"initWithTitle:action:keyEquivalent:\0");
        let set_target_sel = sel(b"setTarget:\0");
        let add_item_sel = sel(b"addItem:\0");
        let make_key_sel = sel(b"makeKeyAndOrderFront:\0");
        let obj_at_sel = sel(b"objectAtIndex:\0");
        let title_sel = sel(b"title\0");
        let length_sel = sel(b"length\0");
        let is_visible_sel = sel(b"isVisible\0");

        let mut window_count = 0u32;

        for i in 0..count {
            let win = m_idx(windows, obj_at_sel, i);
            let title = m0(win, title_sel);
            let title_len = m_usize(title, length_sel);
            let visible = m_bool(win, is_visible_sel);

            // Show windows with a title (excludes the notch widget which has title "")
            if title_len > 0 && visible {
                window_count += 1;
                let item = m3(m0(ns_menu_item, alloc_sel), init_title_sel, title, make_key_sel, empty_key);
                m1(item, set_target_sel, win);
                m1(menu, add_item_sel, item);
            }
        }

        if window_count > 0 {
            let sep = m0(ns_menu_item, sel(b"separatorItem\0"));
            m1(menu, add_item_sel, sep);
        }

        // "New Window" item
        let new_title = m1(ns_string, str_sel, b"New Window\0".as_ptr() as *const c_void);
        let new_win_action = sel(b"newWindow:\0");
        let new_item = m3(m0(ns_menu_item, alloc_sel), init_title_sel, new_title, new_win_action, empty_key);
        let handler = DOCK_HANDLER_PTR.load(Ordering::SeqCst) as *const c_void;
        m1(new_item, set_target_sel, handler);
        m1(menu, add_item_sel, new_item);

        m0(menu, sel(b"autorelease\0"));
        menu
    }
}

/// Register the dock right-click menu via Objective-C runtime.
#[cfg(target_os = "macos")]
fn setup_dock_menu() {
    use std::ffi::c_void;

    extern "C" {
        fn sel_registerName(name: *const i8) -> *const c_void;
        fn objc_msgSend();
        fn objc_getClass(name: *const i8) -> *const c_void;
        fn objc_allocateClassPair(super_cls: *const c_void, name: *const i8, extra: usize) -> *mut c_void;
        fn objc_registerClassPair(cls: *mut c_void);
        fn object_getClass(obj: *const c_void) -> *mut c_void;
        fn class_addMethod(cls: *mut c_void, sel: *const c_void, imp: *const c_void, types: *const i8) -> bool;
    }

    unsafe {
        type Msg0 = extern "C" fn(*const c_void, *const c_void) -> *const c_void;
        let m0: Msg0 = std::mem::transmute(objc_msgSend as *const c_void);

        let sel = |s: &[u8]| sel_registerName(s.as_ptr() as *const i8);
        let cls = |s: &[u8]| objc_getClass(s.as_ptr() as *const i8);

        // Create PeakDockHandler class with newWindow: method
        let ns_object = cls(b"NSObject\0");
        let handler_cls = objc_allocateClassPair(ns_object, b"PeakDockHandler\0".as_ptr() as *const i8, 0);
        if handler_cls.is_null() {
            return;
        }
        class_addMethod(
            handler_cls,
            sel(b"newWindow:\0"),
            handle_new_window as *const c_void,
            b"v@:@\0".as_ptr() as *const i8,
        );
        objc_registerClassPair(handler_cls);

        // [[PeakDockHandler alloc] init]
        let handler = m0(m0(handler_cls as *const c_void, sel(b"alloc\0")), sel(b"init\0"));
        DOCK_HANDLER_PTR.store(handler as usize, Ordering::SeqCst);

        // Add applicationDockMenu: to Tauri's app delegate
        let ns_app = m0(cls(b"NSApplication\0"), sel(b"sharedApplication\0"));
        let delegate = m0(ns_app, sel(b"delegate\0"));
        let delegate_cls = object_getClass(delegate);
        class_addMethod(
            delegate_cls,
            sel(b"applicationDockMenu:\0"),
            dock_menu_imp as *const c_void,
            b"@@:@\0".as_ptr() as *const i8,
        );
    }
}

/// Position the notch window at the absolute top of the screen and set its
/// level above the macOS menu bar so it overlaps the notch.
/// Also sets ignoresMouseEvents:YES so events pass through by default.
#[cfg(target_os = "macos")]
fn configure_notch_window(ns_view_ptr: std::ptr::NonNull<std::ffi::c_void>, width: f64, height: f64) {
    use std::ffi::c_void;

    extern "C" {
        fn sel_registerName(name: *const i8) -> *const c_void;
        fn objc_msgSend();
        fn objc_getClass(name: *const i8) -> *const c_void;
    }

    #[repr(C)]
    #[derive(Copy, Clone)]
    struct CGPoint { x: f64, y: f64 }
    #[repr(C)]
    #[derive(Copy, Clone)]
    struct CGSize { width: f64, height: f64 }
    #[repr(C)]
    #[derive(Copy, Clone)]
    struct CGRect { origin: CGPoint, size: CGSize }

    unsafe {
        let sel = |name: &[u8]| -> *const c_void {
            sel_registerName(name.as_ptr() as *const i8)
        };

        let send_ptr: unsafe extern "C" fn(*const c_void, *const c_void) -> *const c_void =
            std::mem::transmute(objc_msgSend as *const c_void);
        let send_i64: unsafe extern "C" fn(*const c_void, *const c_void, i64) =
            std::mem::transmute(objc_msgSend as *const c_void);
        let send_u64: unsafe extern "C" fn(*const c_void, *const c_void, u64) =
            std::mem::transmute(objc_msgSend as *const c_void);

        // [nsView window] → NSWindow*
        let ns_window = send_ptr(ns_view_ptr.as_ptr() as *const c_void, sel(b"window\0"));
        if ns_window.is_null() { return; }

        // Window level above menu bar (NSStatusWindowLevel = 25)
        send_i64(ns_window, sel(b"setLevel:\0"), 26);

        // Visible on all desktops: canJoinAllSpaces | stationary
        send_u64(ns_window, sel(b"setCollectionBehavior:\0"), (1 << 0) | (1 << 4));

        // Get the main screen's FULL frame (includes the notch / menu bar area)
        let ns_screen_class = objc_getClass(b"NSScreen\0".as_ptr() as *const i8);
        let main_screen = send_ptr(ns_screen_class, sel(b"mainScreen\0"));
        if main_screen.is_null() { return; }

        let send_rect: unsafe extern "C" fn(*const c_void, *const c_void) -> CGRect =
            std::mem::transmute(objc_msgSend as *const c_void);
        let screen_frame = send_rect(main_screen, sel(b"frame\0"));

        // macOS bottom-left origin. Top of screen = origin.y + height - window_height.
        let x = screen_frame.origin.x + (screen_frame.size.width - width) / 2.0;
        let y = screen_frame.origin.y + screen_frame.size.height - height;

        let new_frame = CGRect {
            origin: CGPoint { x, y },
            size: CGSize { width, height },
        };

        let send_frame: unsafe extern "C" fn(*const c_void, *const c_void, CGRect, i8) =
            std::mem::transmute(objc_msgSend as *const c_void);
        send_frame(ns_window, sel(b"setFrame:display:\0"), new_frame, 1);

        // Accept mouse-moved events without needing to be key window.
        let send_bool: unsafe extern "C" fn(*const c_void, *const c_void, i8) =
            std::mem::transmute(objc_msgSend as *const c_void);
        send_bool(ns_window, sel(b"setAcceptsMouseMovedEvents:\0"), 1);

        // Ignore mouse events by default — events pass through to apps below.
        // The frontend will toggle this on when the cursor enters the notch zone.
        send_bool(ns_window, sel(b"setIgnoresMouseEvents:\0"), 1);
    }
}

/// Toggle ignoresMouseEvents on the notch window.
#[cfg(target_os = "macos")]
fn set_notch_ignores_mouse(ns_view_ptr: std::ptr::NonNull<std::ffi::c_void>, ignores: bool) {
    use std::ffi::c_void;
    extern "C" {
        fn sel_registerName(name: *const i8) -> *const c_void;
        fn objc_msgSend();
    }
    unsafe {
        let sel = |name: &[u8]| -> *const c_void {
            sel_registerName(name.as_ptr() as *const i8)
        };
        let send_ptr: unsafe extern "C" fn(*const c_void, *const c_void) -> *const c_void =
            std::mem::transmute(objc_msgSend as *const c_void);
        let ns_window = send_ptr(ns_view_ptr.as_ptr() as *const c_void, sel(b"window\0"));
        if ns_window.is_null() { return; }
        let send_bool: unsafe extern "C" fn(*const c_void, *const c_void, i8) =
            std::mem::transmute(objc_msgSend as *const c_void);
        send_bool(ns_window, sel(b"setIgnoresMouseEvents:\0"), if ignores { 1 } else { 0 });
    }
}

/// Check cursor position relative to the notch window.
/// Returns (in_hover_zone, in_window) — hover zone is top 48px, window is full frame.
#[cfg(target_os = "macos")]
fn check_cursor_position(ns_view_ptr: std::ptr::NonNull<std::ffi::c_void>) -> (bool, bool) {
    use std::ffi::c_void;
    extern "C" {
        fn sel_registerName(name: *const i8) -> *const c_void;
        fn objc_msgSend();
        fn objc_getClass(name: *const i8) -> *const c_void;
    }
    #[repr(C)]
    #[derive(Copy, Clone)]
    struct CGPoint { x: f64, y: f64 }
    #[repr(C)]
    #[derive(Copy, Clone)]
    struct CGSize { width: f64, height: f64 }
    #[repr(C)]
    #[derive(Copy, Clone)]
    struct CGRect { origin: CGPoint, size: CGSize }

    unsafe {
        let sel = |name: &[u8]| -> *const c_void {
            sel_registerName(name.as_ptr() as *const i8)
        };
        let send_ptr: unsafe extern "C" fn(*const c_void, *const c_void) -> *const c_void =
            std::mem::transmute(objc_msgSend as *const c_void);
        let send_rect: unsafe extern "C" fn(*const c_void, *const c_void) -> CGRect =
            std::mem::transmute(objc_msgSend as *const c_void);
        let send_point: unsafe extern "C" fn(*const c_void, *const c_void) -> CGPoint =
            std::mem::transmute(objc_msgSend as *const c_void);

        let ns_window = send_ptr(ns_view_ptr.as_ptr() as *const c_void, sel(b"window\0"));
        if ns_window.is_null() { return (false, false); }
        let win_frame = send_rect(ns_window, sel(b"frame\0"));

        let ns_event_class = objc_getClass(b"NSEvent\0".as_ptr() as *const i8);
        let mouse_loc = send_point(ns_event_class, sel(b"mouseLocation\0"));

        let in_x = mouse_loc.x >= win_frame.origin.x
            && mouse_loc.x <= win_frame.origin.x + win_frame.size.width;
        let in_y = mouse_loc.y >= win_frame.origin.y
            && mouse_loc.y <= win_frame.origin.y + win_frame.size.height;
        let in_window = in_x && in_y;

        // Hover zone = top 28px of the window (just behind the notch)
        let zone_height = 28.0;
        let zone_bottom = win_frame.origin.y + win_frame.size.height - zone_height;
        let in_hover_zone = in_x && mouse_loc.y >= zone_bottom
            && mouse_loc.y <= win_frame.origin.y + win_frame.size.height;

        (in_hover_zone, in_window)
    }
}

/// Tauri command: returns [inHoverZone, inWindow].
/// Proactively sets ignoresMouseEvents=NO when cursor is in the hover zone
/// so that drag-and-drop events can reach the webview without JS roundtrip delay.
#[tauri::command]
fn notch_poll_cursor(app: tauri::AppHandle) -> (bool, bool) {
    #[cfg(target_os = "macos")]
    {
        use raw_window_handle::HasWindowHandle;
        if let Some(notch_win) = app.get_webview_window("notch-widget") {
            if let Ok(handle) = notch_win.window_handle() {
                if let raw_window_handle::RawWindowHandle::AppKit(appkit) = handle.as_raw() {
                    let result = check_cursor_position(appkit.ns_view);
                    // When cursor enters hover zone, immediately make interactive
                    // so drag-and-drop works without waiting for JS roundtrip
                    if result.0 {
                        set_notch_ignores_mouse(appkit.ns_view, false);
                    }
                    return result;
                }
            }
        }
    }
    (false, false)
}

/// Tauri command: set ignoresMouseEvents on the notch window directly.
#[tauri::command]
fn notch_set_interactive(app: tauri::AppHandle, interactive: bool) {
    #[cfg(target_os = "macos")]
    {
        use raw_window_handle::HasWindowHandle;
        if let Some(notch_win) = app.get_webview_window("notch-widget") {
            if let Ok(handle) = notch_win.window_handle() {
                if let raw_window_handle::RawWindowHandle::AppKit(appkit) = handle.as_raw() {
                    set_notch_ignores_mouse(appkit.ns_view, !interactive);
                }
            }
        }
    }
}

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
    #[serde(default = "default_notch_enabled")]
    pub notch_enabled: bool,
    #[serde(default)]
    pub icloud_sync: bool,
    #[serde(default = "default_header_bar")]
    pub header_bar: bool,
    #[serde(default)]
    pub skipped_update_version: String,
    #[serde(default)]
    pub compact_sidebar: bool,
    #[serde(default)]
    pub traffic_lights_in_header: bool,
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

fn default_notch_enabled() -> bool {
    true
}

fn default_header_bar() -> bool {
    true
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: default_theme(),
            vibrancy: default_vibrancy(),
            vibrancy_opacity: default_vibrancy_opacity(),
            vibrancy_blur: default_vibrancy_blur(),
            onboarded: false,
            notch_enabled: default_notch_enabled(),
            icloud_sync: false,
            header_bar: default_header_bar(),
            skipped_update_version: String::new(),
            compact_sidebar: false,
            traffic_lights_in_header: false,
        }
    }
}

/// In-memory cache for the notes index and search text.
struct IndexCache {
    notes: Vec<NoteMeta>,
    loaded: bool,
    search: search::SearchIndex,
    search_built: bool,
}

impl IndexCache {
    fn new() -> Self {
        Self {
            notes: vec![],
            loaded: false,
            search: search::SearchIndex::new(),
            search_built: false,
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

/// Returns the iCloud Drive base directory for Peak, if available.
#[cfg(target_os = "macos")]
fn get_icloud_base() -> Option<PathBuf> {
    let home = std::env::var("HOME").ok()?;
    let icloud = PathBuf::from(home)
        .join("Library/Mobile Documents/com~apple~CloudDocs/Peak");
    Some(icloud)
}

#[cfg(not(target_os = "macos"))]
fn get_icloud_base() -> Option<PathBuf> {
    None
}

fn is_icloud_enabled(app: &tauri::AppHandle) -> bool {
    let path = get_settings_path(app);
    if path.exists() {
        let data = fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str::<AppSettings>(&data)
            .map(|s| s.icloud_sync)
            .unwrap_or(false)
    } else {
        false
    }
}

fn get_local_notes_dir(app: &tauri::AppHandle) -> PathBuf {
    let app_data = app.path().app_data_dir().expect("failed to get app data dir");
    let notes_dir = app_data.join("notes");
    fs::create_dir_all(&notes_dir).ok();
    notes_dir
}

fn get_local_index_path(app: &tauri::AppHandle) -> PathBuf {
    let app_data = app.path().app_data_dir().expect("failed to get app data dir");
    fs::create_dir_all(&app_data).ok();
    app_data.join("notes-index.json")
}

fn get_notes_dir(app: &tauri::AppHandle) -> PathBuf {
    if is_icloud_enabled(app) {
        if let Some(base) = get_icloud_base() {
            let notes_dir = base.join("notes");
            fs::create_dir_all(&notes_dir).ok();
            return notes_dir;
        }
    }
    get_local_notes_dir(app)
}

fn get_index_path(app: &tauri::AppHandle) -> PathBuf {
    if is_icloud_enabled(app) {
        if let Some(base) = get_icloud_base() {
            fs::create_dir_all(&base).ok();
            return base.join("notes-index.json");
        }
    }
    get_local_index_path(app)
}

fn ensure_cache(app: &tauri::AppHandle, cache: &mut IndexCache) {
    if !cache.loaded {
        let path = get_index_path(app);
        if path.exists() {
            let data = fs::read_to_string(&path).unwrap_or_default();
            cache.notes = serde_json::from_str(&data).unwrap_or_default();
        }
        cache.loaded = true;
    }
}

fn flush_index(app: &tauri::AppHandle, notes: &[NoteMeta]) {
    let path = get_index_path(app);
    let data = serde_json::to_string(notes).unwrap_or_default();
    fs::write(path, data).ok();
}

#[tauri::command]
fn list_notes(app: tauri::AppHandle, state: tauri::State<'_, Mutex<IndexCache>>) -> Vec<NoteMeta> {
    let mut cache = state.lock().unwrap();
    ensure_cache(&app, &mut cache);
    cache.notes.clone()
}

#[tauri::command]
fn save_note(app: tauri::AppHandle, state: tauri::State<'_, Mutex<IndexCache>>, id: String, title: String, preview: String, mode: String, pinned: bool, data: Vec<u8>) {
    // Write binary data to disk
    let notes_dir = get_notes_dir(&app);
    let note_path = notes_dir.join(format!("{}.bin", id));
    fs::write(note_path, &data).ok();

    // Update in-memory index
    let mut cache = state.lock().unwrap();
    ensure_cache(&app, &mut cache);

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;

    if let Some(existing) = cache.notes.iter_mut().find(|n| n.id == id) {
        existing.title = title.clone();
        existing.preview = preview;
        existing.mode = mode;
        existing.pinned = pinned;
        existing.updated_at = now;
    } else {
        cache.notes.push(NoteMeta {
            id: id.clone(),
            title: title.clone(),
            preview,
            mode,
            pinned,
            created_at: now,
            updated_at: now,
        });
    }

    // Update search index with extracted text from the Yjs binary
    cache.search.index_note(&id, &title, now, &data);

    // Flush index to disk
    flush_index(&app, &cache.notes);
}

#[tauri::command]
fn load_note(app: tauri::AppHandle, id: String) -> Option<Vec<u8>> {
    let notes_dir = get_notes_dir(&app);
    let note_path = notes_dir.join(format!("{}.bin", id));
    fs::read(note_path).ok()
}

#[tauri::command]
fn delete_note(app: tauri::AppHandle, state: tauri::State<'_, Mutex<IndexCache>>, id: String) {
    let notes_dir = get_notes_dir(&app);
    let note_path = notes_dir.join(format!("{}.bin", id));
    fs::remove_file(note_path).ok();

    let mut cache = state.lock().unwrap();
    ensure_cache(&app, &mut cache);
    cache.notes.retain(|n| n.id != id);
    cache.search.remove(&id);
    flush_index(&app, &cache.notes);
}

/// Migrate notes between local and iCloud storage.
/// Copies all .bin files and notes-index.json from source to destination.
#[tauri::command]
fn toggle_icloud_sync(app: tauri::AppHandle, state: tauri::State<'_, Mutex<IndexCache>>, enable: bool) -> Result<(), String> {
    let icloud_base = get_icloud_base().ok_or("iCloud Drive not available")?;

    let local_notes = get_local_notes_dir(&app);
    let local_index = get_local_index_path(&app);
    let icloud_notes = icloud_base.join("notes");
    let icloud_index = icloud_base.join("notes-index.json");

    let (src_notes, src_index, dst_notes, dst_index) = if enable {
        // Local → iCloud
        (local_notes, local_index, icloud_notes, icloud_index)
    } else {
        // iCloud → Local
        (icloud_notes, icloud_index, local_notes, local_index)
    };

    // Create destination directories
    fs::create_dir_all(&dst_notes).map_err(|e| e.to_string())?;

    // Copy index file
    if src_index.exists() {
        fs::copy(&src_index, &dst_index).map_err(|e| e.to_string())?;
    }

    // Copy all note .bin files
    if src_notes.exists() {
        if let Ok(entries) = fs::read_dir(&src_notes) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().map_or(false, |e| e == "bin") {
                    let dest = dst_notes.join(entry.file_name());
                    fs::copy(&path, &dest).map_err(|e| e.to_string())?;
                }
            }
        }
    }

    // Invalidate the in-memory cache so next access reads from new location
    let mut cache = state.lock().unwrap();
    cache.loaded = false;
    cache.notes.clear();
    cache.search = search::SearchIndex::new();
    cache.search_built = false;

    Ok(())
}

/// Show or hide the notch widget window.
#[tauri::command]
fn set_notch_visible(app: tauri::AppHandle, visible: bool) {
    if let Some(notch_win) = app.get_webview_window("notch-widget") {
        if visible {
            notch_win.show().ok();
        } else {
            notch_win.hide().ok();
        }
    }
}

/// The keyboard shortcut that opens the quick-append popup.
/// Cmd+Option+Enter on macOS, Ctrl+Alt+Enter elsewhere.
fn quick_append_shortcut() -> tauri_plugin_global_shortcut::Shortcut {
    use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut};
    #[cfg(target_os = "macos")]
    let mods = Modifiers::SUPER | Modifiers::ALT;
    #[cfg(not(target_os = "macos"))]
    let mods = Modifiers::CONTROL | Modifiers::ALT;
    Shortcut::new(Some(mods), Code::Enter)
}

/// Build (if needed) the quick-append popup window.
fn ensure_quick_append_window(app: &tauri::AppHandle) -> Option<tauri::WebviewWindow> {
    if let Some(win) = app.get_webview_window("quick-append") {
        return Some(win);
    }

    let width: f64 = 560.0;
    let height: f64 = 300.0;

    // Match the main window's builder as closely as possible (Overlay
    // title bar + hidden title + transparent + decorations:false is what
    // gives macOS a properly rounded window mask + shadow). Only diverge
    // on always-on-top + skip-taskbar so it behaves like a popup.
    let res = WebviewWindowBuilder::new(
        app,
        "quick-append",
        tauri::WebviewUrl::App("quick-append.html".into()),
    )
    .title("Quick Append")
    .inner_size(width, height)
    .min_inner_size(420.0, 220.0)
    .title_bar_style(tauri::TitleBarStyle::Overlay)
    .hidden_title(true)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .visible(false)
    .build();

    res.ok().map(|w| {
        let _ = w.center();
        w
    })
}

/// Show & focus the quick-append window. If already visible, hide it.
fn toggle_quick_append_window(app: &tauri::AppHandle) {
    let win = match ensure_quick_append_window(app) {
        Some(w) => w,
        None => return,
    };

    let visible = win.is_visible().unwrap_or(false);
    if visible {
        let _ = win.emit("quick-append-closing", ());
        let _ = win.hide();
    } else {
        let _ = win.center();
        let _ = win.show();
        let _ = win.set_focus();
        let _ = win.emit("quick-append-opened", ());
    }
}

/// Hide the quick-append window from JS.
#[tauri::command]
fn hide_quick_append(app: tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("quick-append") {
        let _ = win.hide();
    }
}

/// Show the quick-append window from JS (e.g. menu invocation).
#[tauri::command]
fn show_quick_append(app: tauri::AppHandle) {
    if let Some(win) = ensure_quick_append_window(&app) {
        let _ = win.center();
        let _ = win.show();
        let _ = win.set_focus();
        let _ = win.emit("quick-append-opened", ());
    }
}

/// Build the search index from disk if not already built.
/// Reads all .bin files once, extracts text, caches in memory.
fn ensure_search_index(app: &tauri::AppHandle, cache: &mut IndexCache) {
    if cache.search_built { return; }
    ensure_cache(app, cache);

    let notes_dir = get_notes_dir(app);
    for meta in &cache.notes {
        if cache.search.len() > 0 {
            // Already indexed (e.g. via save_note during this session)
            // Skip notes that are already in the index
        }
        let path = notes_dir.join(format!("{}.bin", meta.id));
        if let Ok(data) = fs::read(&path) {
            cache.search.index_note(&meta.id, &meta.title, meta.updated_at, &data);
        } else {
            cache.search.index_note_meta(&meta.id, &meta.title, &meta.preview, meta.updated_at);
        }
    }
    cache.search_built = true;
}

#[tauri::command]
fn search_notes(app: tauri::AppHandle, state: tauri::State<'_, Mutex<IndexCache>>, query: String) -> Vec<search::SearchResult> {
    let mut cache = state.lock().unwrap();
    ensure_search_index(&app, &mut cache);
    cache.search.search(&query)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    use tauri_plugin_global_shortcut::ShortcutState;
                    if event.state() == ShortcutState::Pressed {
                        toggle_quick_append_window(app);
                    }
                })
                .build(),
        )
        .manage(Mutex::new(IndexCache::new()))
        .setup(|app| {
            // Build macOS-style app menu
            let settings_item = MenuItem::with_id(app, "settings", "Settings…", true, Some("CmdOrCtrl+,"))?;
            let separator = PredefinedMenuItem::separator(app)?;
            let quit = PredefinedMenuItem::quit(app, Some("Quit Peak"))?;
            let hide = PredefinedMenuItem::hide(app, Some("Hide Peak"))?;
            let show_all = PredefinedMenuItem::show_all(app, Some("Show All"))?;

            let app_menu = Submenu::with_items(app, "Peak", true, &[
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

            // Store app handle for dock menu / multi-window
            APP_HANDLE.set(app.handle().clone()).ok();

            // Register macOS dock right-click menu
            #[cfg(target_os = "macos")]
            setup_dock_menu();

            // --- Main window close behavior ---
            // If notch is active: hide the window (app stays alive for the notch)
            // If notch is disabled: let the app quit normally
            if let Some(main_win) = app.get_webview_window("main") {
                let w = main_win.clone();
                let handle = app.handle().clone();
                main_win.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        let notch_visible = handle.get_webview_window("notch-widget")
                            .and_then(|nw| nw.is_visible().ok())
                            .unwrap_or(false);
                        if notch_visible {
                            // Notch is running — just hide the main window
                            api.prevent_close();
                            w.hide().ok();
                        } else {
                            // App is about to quit — close the quick-append popup
                            // window so it doesn't keep the process alive.
                            if let Some(qa) = handle.get_webview_window("quick-append") {
                                qa.close().ok();
                            }
                        }
                    }
                });
            }

            // --- Create the notch widget window (if enabled) ---
            let settings_path = get_settings_path(&app.handle());
            let notch_enabled = if settings_path.exists() {
                let data = fs::read_to_string(&settings_path).unwrap_or_default();
                serde_json::from_str::<AppSettings>(&data)
                    .map(|s| s.notch_enabled)
                    .unwrap_or(true)
            } else {
                true
            };

            let widget_width: f64 = 440.0;
            let widget_height: f64 = 140.0;

            WebviewWindowBuilder::new(
                app,
                "notch-widget",
                tauri::WebviewUrl::App("notch.html".into()),
            )
            .title("")
            .inner_size(widget_width, widget_height)
            .position(0.0, 0.0) // repositioned below via NSWindow
            .decorations(false)
            .transparent(true)
            .always_on_top(true)
            .skip_taskbar(true)
            .focused(false)
            .visible(notch_enabled)
            .resizable(false)
            .shadow(false)
            .disable_drag_drop_handler()
            .build()?;

            // Position at absolute top of screen (over the notch) + set up mouse passthrough
            #[cfg(target_os = "macos")]
            {
                use raw_window_handle::HasWindowHandle;
                if let Some(notch_win) = app.get_webview_window("notch-widget") {
                    if let Ok(handle) = notch_win.window_handle() {
                        if let raw_window_handle::RawWindowHandle::AppKit(appkit) =
                            handle.as_raw()
                        {
                            configure_notch_window(appkit.ns_view, widget_width, widget_height);
                        }
                    }
                }
            }

            // --- Bridge: notch "+" click → show main window & create note ---
            let app_handle = app.handle().clone();
            app.listen("notch-create-note", move |_event| {
                if let Some(main_window) = app_handle.get_webview_window("main") {
                    main_window.show().ok();
                    main_window.set_focus().ok();
                    main_window.emit("create-note-from-notch", ()).ok();
                }
            });

            // --- Bridge: notch note click → show main window & open note ---
            let app_handle2 = app.handle().clone();
            app.listen("notch-open-note", move |event| {
                if let Some(main_window) = app_handle2.get_webview_window("main") {
                    main_window.show().ok();
                    main_window.set_focus().ok();
                    // Forward the note ID payload to the main window
                    main_window.emit("open-note-from-notch", event.payload()).ok();
                }
            });

            // --- Bridge: notch markdown drop → show main window & import ---
            let app_handle3 = app.handle().clone();
            app.listen("notch-import-markdown", move |event| {
                if let Some(main_window) = app_handle3.get_webview_window("main") {
                    main_window.show().ok();
                    main_window.set_focus().ok();
                    main_window.emit("import-markdown-from-notch", event.payload()).ok();
                }
            });

            // --- Bridge: notch HTML drop → show main window & import ---
            let app_handle4 = app.handle().clone();
            app.listen("notch-import-html", move |event| {
                if let Some(main_window) = app_handle4.get_webview_window("main") {
                    main_window.show().ok();
                    main_window.set_focus().ok();
                    main_window.emit("import-html-from-notch", event.payload()).ok();
                }
            });

            // --- Bridge: notch zip drop → show main window & import ---
            let app_handle5 = app.handle().clone();
            app.listen("notch-import-zip", move |event| {
                if let Some(main_window) = app_handle5.get_webview_window("main") {
                    main_window.show().ok();
                    main_window.set_focus().ok();
                    main_window.emit("import-zip-from-notch", event.payload()).ok();
                }
            });

            // --- Register the global Cmd+Opt+Enter shortcut for quick-append ---
            {
                use tauri_plugin_global_shortcut::GlobalShortcutExt;
                if let Err(err) = app.global_shortcut().register(quick_append_shortcut()) {
                    eprintln!("failed to register quick-append shortcut: {err}");
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_notes,
            save_note,
            load_note,
            delete_note,
            load_settings,
            save_settings,
            toggle_icloud_sync,
            notch_poll_cursor,
            notch_set_interactive,
            set_notch_visible,
            search_notes,
            hide_quick_append,
            show_quick_append,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    // Run with event handler — reshow main window when Dock icon clicked
    app.run(|app_handle, event| {
        if let tauri::RunEvent::Reopen { .. } = event {
            if let Some(window) = app_handle.get_webview_window("main") {
                window.show().ok();
                window.set_focus().ok();
            } else {
                // All main windows closed — create a fresh one
                create_new_main_window(app_handle);
            }
        }
    });
}
