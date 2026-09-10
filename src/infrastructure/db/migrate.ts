import type { AppDatabase } from './database'

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS styles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    platform TEXT NOT NULL,
    category TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS style_documents (
    id TEXT PRIMARY KEY,
    style_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    content TEXT NOT NULL,
    word_count INTEGER NOT NULL,
    parse_status TEXT NOT NULL,
    parse_error TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (style_id) REFERENCES styles(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS style_profiles (
    id TEXT PRIMARY KEY,
    style_id TEXT NOT NULL UNIQUE,
    json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (style_id) REFERENCES styles(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS style_structure_templates (
    id TEXT PRIMARY KEY,
    style_id TEXT NOT NULL,
    json TEXT NOT NULL,
    FOREIGN KEY (style_id) REFERENCES styles(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS style_examples (
    id TEXT PRIMARY KEY,
    style_id TEXT NOT NULL,
    json TEXT NOT NULL,
    FOREIGN KEY (style_id) REFERENCES styles(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    topic TEXT NOT NULL,
    draft TEXT NOT NULL DEFAULT '',
    platform TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL,
    content_type TEXT NOT NULL,
    style_id TEXT,
    commercial_json TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS scripts (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS script_versions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    label TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS pfdbi_analyses (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL UNIQUE,
    json TEXT NOT NULL,
    cache_key TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS vision_observations (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    image_id TEXT NOT NULL,
    json TEXT NOT NULL,
    cache_key TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS reference_images (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    path TEXT NOT NULL,
    filename TEXT NOT NULL,
    hash TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'primary',
    vehicle_label TEXT NOT NULL DEFAULT '',
    comparison_note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS image_annotations (
    id TEXT PRIMARY KEY,
    image_id TEXT NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    width REAL NOT NULL,
    height REAL NOT NULL,
    note TEXT NOT NULL,
    FOREIGN KEY (image_id) REFERENCES reference_images(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS platform_profiles (
    platform TEXT PRIMARY KEY,
    json TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS duration_profiles (
    id TEXT PRIMARY KEY,
    json TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS llm_usage (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    task TEXT NOT NULL,
    model TEXT NOT NULL,
    prompt_tokens INTEGER NOT NULL,
    completion_tokens INTEGER NOT NULL,
    total_tokens INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL,
    estimated INTEGER NOT NULL,
    created_at TEXT NOT NULL
  )`
]

/**
 * 初始化全部业务表。
 */
export function runMigrations(db: AppDatabase): void {
  for (const sql of STATEMENTS) {
    db.exec(sql)
  }
  ensureColumn(db, 'reference_images', 'role', "TEXT NOT NULL DEFAULT 'primary'")
  ensureColumn(db, 'reference_images', 'vehicle_label', "TEXT NOT NULL DEFAULT ''")
  ensureColumn(db, 'reference_images', 'comparison_note', "TEXT NOT NULL DEFAULT ''")
  db.exec("UPDATE reference_images SET role = 'other' WHERE role IN ('vertical', 'horizontal')")
  db.exec(`UPDATE styles SET category = '设计观点' WHERE category NOT IN (
    '车型解读','设计知识','设计观点','设计回顾','新车热点','设计跨界'
  )`)
  db.exec(`UPDATE projects SET content_type = '车型解读' WHERE content_type NOT IN (
    '车型解读','设计知识','设计观点','设计回顾','新车热点','设计跨界'
  )`)
}

/**
 * 为已有本地数据库补充列，避免重复执行 ALTER TABLE。
 */
function ensureColumn(db: AppDatabase, table: string, column: string, definition: string): void {
  const columns = db.all<{ name: string }>(`PRAGMA table_info(${table})`)
  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
}
