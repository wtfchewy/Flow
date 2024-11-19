use tauri::{
    LogicalPosition, LogicalSize, Position, Size, WebviewUrl, WebviewWindowBuilder,
};

#[cfg(target_os = "macos")]
use tauri::TitleBarStyle;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn set_window_size(size: String, window: tauri::Window) {
    let monitor = window
        .current_monitor()
        .expect("Failed to get current monitor")
        .expect("Failed to unwrap monitor");
    let window_height = monitor.size().height as f64;
    let window_width = monitor.size().width as f64 / 8.4;

    let center_x = (monitor.size().width as f64 / 4.0) - (1250.0 / 2.0);
    let center_y = (monitor.size().height as f64 / 4.5) - (750.0 / 2.0);

    if size == "small" {
        window
            .set_size(Size::Logical(LogicalSize {
                width: window_width,
                height: window_height,
            }))
            .unwrap();
        window
            .set_position(Position::Logical(LogicalPosition { x: 0.0, y: 0.0 }))
            .unwrap();
        window.set_always_on_top(true).unwrap();
        window.set_decorations(true).unwrap();
    } else if size == "normal" {
        window
            .set_size(Size::Logical(LogicalSize {
                width: 1250.0,
                height: 750.0,
            }))
            .unwrap();
        window
            .set_position(Position::Logical(LogicalPosition {
                x: center_x,
                y: center_y,
            }))
            .unwrap();
        window.set_always_on_top(false).unwrap();
        window.set_decorations(true).unwrap();
    } else if size == "focus" {
        window
            .set_size(Size::Logical(LogicalSize {
                width: window_width,
                height: 55.4,
            }))
            .unwrap();
        window.set_always_on_top(true).unwrap();
        window.set_decorations(false).unwrap();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![set_window_size])
        .setup(|app| {
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
                    let bg_color = NSColor::colorWithRed_green_blue_alpha_(
                        nil,
                        23.0 / 255.0,
                        22.0 / 255.0,
                        29.0 / 255.0,
                        1.0,
                    );
                    ns_window.setBackgroundColor_(bg_color);
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
