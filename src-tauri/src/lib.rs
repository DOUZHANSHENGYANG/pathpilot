use serde::{Deserialize, Serialize};
use std::ffi::OsStr;
use std::fs;
use std::os::windows::ffi::OsStrExt;
use std::path::{Path, PathBuf};
use windows::Win32::UI::Shell::{
    SHFILEOPSTRUCTW, SHFileOperationW, FOF_NOCONFIRMMKDIR, FO_COPY, FO_MOVE,
};
use windows::Win32::Foundation::HWND;
use windows::core::PCWSTR;

// ─── Structs ─────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PathInfo {
    pub original: String,
    pub expanded: String,
    pub exists: bool,
    pub is_file: bool,
    pub is_dir: bool,
    pub parent_dir: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Settings {
    pub theme: String,
    pub language: String,
    pub target_dir: String,
    pub config_dir: String,
}

// ─── Helper Functions ────────────────────────────────────────────────────────

fn get_desktop_path() -> String {
    // Try USERPROFILE env var first, append Desktop
    if let Ok(userprofile) = std::env::var("USERPROFILE") {
        let desktop = PathBuf::from(&userprofile).join("Desktop");
        if desktop.exists() {
            return desktop.to_string_lossy().to_string();
        }
    }
    // Fallback: try HOMEDRIVE + HOMEPATH
    if let (Ok(drive), Ok(homepath)) = (std::env::var("HOMEDRIVE"), std::env::var("HOMEPATH")) {
        let desktop = PathBuf::from(format!("{}{}", drive, homepath)).join("Desktop");
        if desktop.exists() {
            return desktop.to_string_lossy().to_string();
        }
    }
    // Last resort
    String::from("C:\\Users\\Default\\Desktop")
}

fn get_exe_dir() -> Result<PathBuf, String> {
    std::env::current_exe()
        .map_err(|e| format!("Failed to get exe path: {}", e))?
        .parent()
        .map(|p| p.to_path_buf())
        .ok_or_else(|| "Failed to get exe parent directory".to_string())
}

fn get_config_dir() -> PathBuf {
    let exe_dir = get_exe_dir().unwrap_or_else(|_| PathBuf::from("."));
    let pointer_file = exe_dir.join("config_dir.txt");
    if pointer_file.exists() {
        if let Ok(content) = fs::read_to_string(&pointer_file) {
            let trimmed = content.trim();
            if !trimmed.is_empty() {
                let path = PathBuf::from(trimmed);
                if path.exists() && path.is_dir() {
                    return path;
                }
            }
        }
    }
    exe_dir
}

fn get_settings_path(config_dir: &Path) -> PathBuf {
    config_dir.join("settings.json")
}

fn normalize_path(input: &str) -> String {
    // Replace forward slashes with backslashes for Windows consistency
    input.replace('/', "\\")
}

fn strip_quotes(s: &str) -> &str {
    let s = s.trim();
    // Strip matching single quotes
    if s.starts_with('\'') && s.ends_with('\'') && s.len() >= 2 {
        &s[1..s.len() - 1]
    }
    // Strip matching double quotes
    else if s.starts_with('"') && s.ends_with('"') && s.len() >= 2 {
        &s[1..s.len() - 1]
    } else {
        s
    }
}

/// Convert a Rust string to a null-terminated wide string (UTF-16) for Win32 API.
fn to_wide_null(s: &str) -> Vec<u16> {
    OsStr::new(s).encode_wide().chain(std::iter::once(0)).collect()
}

/// Delegate file operation (copy/move) to Windows SHFileOperationW.
/// This gives us native progress UI, conflict resolution, and shell integration.
fn windows_file_operation(op_type: u32, source: &str, target_dir: &str) -> Result<String, String> {
    let mut src_wide = to_wide_null(source);
    // Double-null terminate for SHFileOperationW
    src_wide.push(0);

    let mut dest_wide = to_wide_null(target_dir);
    dest_wide.push(0);

    let mut file_op = SHFILEOPSTRUCTW {
        hwnd: HWND(std::ptr::null_mut()),
        wFunc: op_type,
        pFrom: PCWSTR(src_wide.as_ptr()),
        pTo: PCWSTR(dest_wide.as_ptr()),
        fFlags: FOF_NOCONFIRMMKDIR.0 as u16,
        fAnyOperationsAborted: false.into(),
        hNameMappings: std::ptr::null_mut(),
        lpszProgressTitle: PCWSTR::null(),
    };

    let result = unsafe { SHFileOperationW(&mut file_op) };

    // Check if user cancelled the operation first
    if file_op.fAnyOperationsAborted.as_bool() {
        let action = if op_type == FO_COPY { "copy" } else { "move" };
        return Ok(format!("__CANCELLED__:{}", action));
    }

    // Only treat non-zero as error if not aborted
    if result != 0 {
        return Err(format!("File operation failed with code: {}", result));
    }

    let action = if op_type == FO_COPY { "Copied" } else { "Moved" };
    println!("[file_op] {}: '{}' -> '{}'", action, source, target_dir);
    Ok(format!("{} to {}", action, target_dir))
}

// ─── Tauri Commands ──────────────────────────────────────────────────────────

#[tauri::command]
fn parse_path(input: String) -> Result<PathInfo, String> {
    println!("[parse_path] raw input: '{}'", input);

    // Step 1: Strip leading/trailing whitespace
    let trimmed = input.trim();

    // Step 2: Strip matching quotes
    let unquoted = strip_quotes(trimmed);

    // Step 3: Strip invisible Unicode control characters
    // (commonly introduced when copying paths from WeChat/QQ/browsers)
    let cleaned: String = unquoted
        .chars()
        .filter(|c| !c.is_control() || *c == '\r' || *c == '\n' || *c == '\t')
        .filter(|c| {
            let code = *c as u32;
            // Remove bidirectional text markers (U+200E, U+200F, U+202A-U+202E, U+2066-U+2069)
            !matches!(
                code,
                0x200E | 0x200F | 0x202A..=0x202E | 0x2066..=0x2069 | 0xFEFF
            )
        })
        .collect();

    // Step 4: Normalize path separators
    let normalized = normalize_path(&cleaned);

    // Step 4: Expand environment variables like %USERPROFILE%, %APPDATA%
    let expanded = shellexpand::env(&normalized)
        .map_err(|e| format!("Failed to expand env vars: {}", e))?
        .to_string();

    println!("[parse_path] expanded: '{}'", expanded);

    // Step 5: Check filesystem
    let path = Path::new(&expanded);
    let exists = path.exists();
    let is_file = path.is_file();
    let is_dir = path.is_dir();

    // Step 6: Get parent directory
    let parent_dir = path
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();

    println!(
        "[parse_path] exists={}, is_file={}, is_dir={}, parent={}",
        exists, is_file, is_dir, parent_dir
    );

    Ok(PathInfo {
        original: input,
        expanded,
        exists,
        is_file,
        is_dir,
        parent_dir,
    })
}

#[tauri::command]
fn copy_to_target(source: String, target_dir: String) -> Result<String, String> {
    println!(
        "[copy_to_target] source='{}', target_dir='{}'",
        source, target_dir
    );

    let src_path = Path::new(&source);
    if !src_path.exists() {
        return Err(format!("Source path does not exist: {}", source));
    }

    // Delegate to Windows SHFileOperationW for native copy with progress UI
    windows_file_operation(FO_COPY, &source, &target_dir)
}

#[tauri::command]
fn move_to_target(source: String, target_dir: String) -> Result<String, String> {
    println!(
        "[move_to_target] source='{}', target_dir='{}'",
        source, target_dir
    );

    let src_path = Path::new(&source);
    if !src_path.exists() {
        return Err(format!("Source path does not exist: {}", source));
    }

    // Delegate to Windows SHFileOperationW for native move with progress UI
    windows_file_operation(FO_MOVE, &source, &target_dir)
}

#[tauri::command]
fn open_in_explorer(path: String) -> Result<(), String> {
    println!("[open_in_explorer] path='{}'", path);

    // Security: reject paths containing double quotes to prevent command injection
    if path.contains('"') {
        return Err("Path contains invalid characters".to_string());
    }

    // Verify path exists before opening
    let path_obj = Path::new(&path);
    if !path_obj.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    // Open the directory in Explorer
    let status = std::process::Command::new("explorer")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("Failed to launch explorer: {}", e))?;
    println!("[open_in_explorer] Spawned explorer pid={:?}", status.id());

    Ok(())
}

#[tauri::command]
fn load_settings() -> Result<Settings, String> {
    println!("[load_settings] Loading settings...");

    let config_dir = get_config_dir();
    let settings_path = get_settings_path(&config_dir);
    println!("[load_settings] Config dir: {:?}, Settings path: {:?}", config_dir, settings_path);

    if settings_path.exists() {
        let content = fs::read_to_string(&settings_path)
            .map_err(|e| format!("Failed to read settings.json: {}", e))?;
        let mut settings: Settings = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse settings.json: {}", e))?;
        // Ensure config_dir is present (backwards compat)
        if settings.config_dir.is_empty() {
            settings.config_dir = config_dir.to_string_lossy().to_string();
        }
        println!("[load_settings] Loaded: {:?}", settings);
        Ok(settings)
    } else {
        let defaults = Settings {
            theme: "light".to_string(),
            language: "zh".to_string(),
            target_dir: get_desktop_path(),
            config_dir: config_dir.to_string_lossy().to_string(),
        };
        println!("[load_settings] No settings file, using defaults: {:?}", defaults);
        Ok(defaults)
    }
}

#[tauri::command]
fn save_settings(settings: Settings) -> Result<(), String> {
    println!("[save_settings] Saving settings: {:?}", settings);

    // If user changed config_dir, persist the pointer file
    let exe_dir = get_exe_dir()?;
    let config_dir = PathBuf::from(&settings.config_dir);
    let pointer_file = exe_dir.join("config_dir.txt");

    if config_dir != exe_dir {
        fs::write(&pointer_file, &settings.config_dir)
            .map_err(|e| format!("Failed to write config_dir.txt: {}", e))?;
    } else if pointer_file.exists() {
        // If user reset to default, remove the pointer file
        let _ = fs::remove_file(&pointer_file);
    }

    let settings_path = get_settings_path(&config_dir);
    println!("[save_settings] Writing to: {:?}", settings_path);

    // Ensure config directory exists
    fs::create_dir_all(&config_dir)
        .map_err(|e| format!("Failed to create config dir: {}", e))?;

    let json = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    fs::write(&settings_path, json)
        .map_err(|e| format!("Failed to write settings.json: {}", e))?;

    println!("[save_settings] Done.");
    Ok(())
}

#[tauri::command]
fn get_config_dir_command() -> Result<String, String> {
    Ok(get_config_dir().to_string_lossy().to_string())
}

// ─── Application Entry Point ─────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            parse_path,
            copy_to_target,
            move_to_target,
            open_in_explorer,
            load_settings,
            save_settings,
            get_config_dir_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
