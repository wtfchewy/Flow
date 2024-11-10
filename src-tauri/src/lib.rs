use tauri::{TitleBarStyle, WebviewUrl, WebviewWindowBuilder, PhysicalSize, Size};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn set_window_size(size: String, window: tauri::Window) {
    // println!("Window: {}", window.label());
    // println!("{}", window.current_monitor().unwrap().size());
    if size == "small" {
      window.set_size(Size::Physical(PhysicalSize { width: 350, height: 800 })).unwrap();
    } else if size == "normal" {
      window.set_size(Size::Physical(PhysicalSize { width: 1250, height: 750 })).unwrap();
    }
    // window.set_size(Size::Physical(PhysicalSize { width: 350, height: 800 })).unwrap();
  }

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
                        17.0 / 255.0,
                        17.0 / 255.0,
                        17.5 / 255.0,
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
