use tauri::{Window, LogicalPosition, PhysicalPosition, PhysicalSize, Position, Size, WebviewUrl, WebviewWindowBuilder};
use serde_json::json;
use tauri_plugin_store::StoreExt;

#[cfg(target_os = "macos")]
use tauri::TitleBarStyle;

fn hex_to_rgb(hex: &str) -> (f64, f64, f64) {
    let hex = hex.trim_start_matches('#');
    let r = u8::from_str_radix(&hex[0..2], 16).unwrap() as f64 / 255.0;
    let g = u8::from_str_radix(&hex[2..4], 16).unwrap() as f64 / 255.0;
    let b = u8::from_str_radix(&hex[4..6], 16).unwrap() as f64 / 255.0;
    (r, g, b)
}

#[tauri::command]
fn set_window_size(size: String, window: Window) {
    let monitor = window
        .current_monitor()
        .expect("Failed to get current monitor")
        .expect("Failed to unwrap monitor");

    let monitor_size = monitor.size();
    let monitor_position = monitor.position();

    let screen_width = monitor_size.width as f64;
    let screen_height = monitor_size.height as f64;

    let (width, height) = match size.as_str() {
        "small" => (screen_width * 0.21, screen_height), 
        "normal" => (screen_width * 0.75, screen_height * 0.73),
        "focus" => (screen_width * 0.2, screen_height * 0.05),
        _ => (screen_width * 0.5, screen_height * 0.7),
    };

    let window_size = PhysicalSize::new(width as u32, height as u32);

    let position_x = monitor_position.x as f64 + (screen_width - width) / 2.0;
    let position_y = monitor_position.y as f64 + (screen_height - height) / 2.0;

    let window_position = PhysicalPosition::new(position_x as i32, position_y as i32);

    window
        .set_size(Size::Physical(window_size))
        .unwrap();

    match size.as_str() {
        "small" => {
            window.set_always_on_top(true).unwrap();
            window.set_decorations(true).unwrap();
            window.set_position(Position::Logical(LogicalPosition { x: 0.0, y: 0.0 })).unwrap();
        }
        "normal" => {
            window.set_always_on_top(false).unwrap();
            window.set_decorations(true).unwrap();
            window.set_position(Position::Physical(window_position)).unwrap();
        }
        "focus" => { 
            window.set_always_on_top(true).unwrap();
            window.set_decorations(false).unwrap(); 
            window.set_position(Position::Logical(LogicalPosition { x: 0.0, y: 0.0 })).unwrap();
        }
        _ => {}
    }
}

#[tauri::command]
fn set_background_color(color: String, window: Window) {
    #[cfg(target_os = "macos")]
    {
        use cocoa::appkit::{NSColor, NSWindow};
        use cocoa::base::{id, nil};

        let ns_window = window.ns_window().unwrap() as id;
        unsafe {
            let (r, g, b) = hex_to_rgb(color.as_str());
            let bg_color = NSColor::colorWithRed_green_blue_alpha_(nil, r, g, b, 1.0);
            ns_window.setBackgroundColor_(bg_color);
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![set_window_size, set_background_color])
        .setup(|app| {
            let default = json!({
                "primary": "#6b56ff",
                "primary-content": "#ffffff",
                "primary-dark": "#3e23ff",
                "primary-light": "#9889ff",
                "secondary": "#bf56ff",
                "secondary-content": "#350056",
                "secondary-dark": "#ac23ff",
                "secondary-light": "#d289ff",
                "background": "#17161d",
                "foreground": "#22212c",
                "border": "#393649",
                "copy": "#fbfbfc",
                "copy-light": "#d4d3de",
                "copy-lighter": "#9c98b3",
                "success": "#56ff56",
                "warning": "#ffff56",
                "error": "#ff5656",
                "success-content": "#005600",
                "warning-content": "#565600",
                "error-content": "#560000"
            });
            // set default for first launches
            let store = app.store("settings.json")?;
            let theme = store.get("theme").unwrap_or(default);
            let bg_color_hex = theme["background"]
                .as_str()
                .expect("Failed to get background color");

            let win_builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                .title("")
                .inner_size(1250.0, 750.0);

            // set transparent title bar only when building for macOS
            #[cfg(target_os = "macos")]
            let win_builder = win_builder.title_bar_style(TitleBarStyle::Transparent);

            let window = win_builder.build().unwrap();

            // set background color only when building for macOS
            #[cfg(target_os = "macos")]
            {
                use cocoa::appkit::{NSColor, NSWindow};
                use cocoa::base::{id, nil};

                let ns_window = window.ns_window().unwrap() as id;
                unsafe {
                    let (r, g, b) = hex_to_rgb(bg_color_hex);
                    let bg_color = NSColor::colorWithRed_green_blue_alpha_(nil, r, g, b, 1.0);
                    ns_window.setBackgroundColor_(bg_color);
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
