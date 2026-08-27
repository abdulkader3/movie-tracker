mod backup;
mod keychain;

use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "create initial tables",
        sql: include_str!("../migrations/0001_init.sql"),
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations("sqlite:movietracker.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            backup::get_app_data_dir,
            backup::create_db_backup,
            backup::swap_database,
            backup::validate_sqlite_file,
            backup::remove_file_if_exists,
            keychain::keychain_set_password,
            keychain::keychain_get_password,
            keychain::keychain_delete_password,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Movie Tracker");
}
