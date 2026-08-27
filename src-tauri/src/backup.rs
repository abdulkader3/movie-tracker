use rusqlite::backup::Backup;
use rusqlite::Connection;
use std::fs;
use std::path::PathBuf;
use tauri::command;
use tauri::AppHandle;
use tauri::Manager;

#[command]
pub fn get_app_data_dir(app: AppHandle) -> Result<String, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {e}"))?;
    Ok(path.to_string_lossy().into_owned())
}

#[command]
pub fn create_db_backup(app: AppHandle, dest_path: String) -> Result<u64, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {e}"))?;
    let db_path = data_dir.join("movietracker.db");

    if !db_path.exists() {
        return Err("Database file not found".into());
    }

    let dest = PathBuf::from(&dest_path);
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create backup directory: {e}"))?;
    }

    let source =
        Connection::open(&db_path).map_err(|e| format!("Failed to open source database: {e}"))?;
    let mut backup_conn =
        Connection::open(&dest).map_err(|e| format!("Failed to create backup file: {e}"))?;

    let backup = Backup::new(&source, &mut backup_conn)
        .map_err(|e| format!("Failed to initialize backup: {e}"))?;

    backup
        .run_to_completion(256, std::time::Duration::ZERO, None)
        .map_err(|e| format!("Backup failed: {e}"))?;

    let size = fs::metadata(&dest)
        .map(|m| m.len())
        .unwrap_or(0);

    Ok(size)
}

#[command]
pub fn swap_database(app: AppHandle, new_db_path: String) -> Result<(), String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {e}"))?;
    let db_path = data_dir.join("movietracker.db");
    let safety_path = data_dir.join("movietracker.db.safety");
    let new_path = PathBuf::from(&new_db_path);

    if !new_path.exists() {
        return Err("New database file does not exist".into());
    }

    if db_path.exists() {
        fs::copy(&db_path, &safety_path)
            .map_err(|e| format!("Failed to create safety backup: {e}"))?;
    }

    fs::copy(&new_path, &db_path)
        .map_err(|e| format!("Failed to replace database: {e}"))?;

    let _ = fs::remove_file(data_dir.join("movietracker.db-wal"));
    let _ = fs::remove_file(data_dir.join("movietracker.db-shm"));

    let _ = fs::remove_file(&safety_path);
    let _ = fs::remove_file(&new_path);

    Ok(())
}

#[command]
pub fn validate_sqlite_file(path: String) -> Result<bool, String> {
    let file_path = PathBuf::from(&path);
    if !file_path.exists() {
        return Err("File does not exist".into());
    }

    let mut file = fs::File::open(&file_path).map_err(|e| format!("Cannot open file: {e}"))?;
    let mut header = [0u8; 16];
    use std::io::Read;
    file.read_exact(&mut header)
        .map_err(|e| format!("Cannot read file header: {e}"))?;

    let magic = b"SQLite format 3\0";
    if &header != magic {
        return Ok(false);
    }

    match Connection::open(&file_path) {
        Ok(conn) => {
            let result: Result<String, _> =
                conn.query_row("SELECT sqlite_version()", [], |row| row.get(0));
            Ok(result.is_ok())
        }
        Err(_) => Ok(false),
    }
}

#[command]
pub fn remove_file_if_exists(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if p.exists() {
        fs::remove_file(&p).map_err(|e| format!("Failed to remove file: {e}"))?;
    }
    Ok(())
}
