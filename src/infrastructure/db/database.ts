import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'fs'
import { dirname } from 'path'
import { runMigrations } from './migrate'

/**
 * 对 node:sqlite 的轻量封装，保持本地 SQLite 架构。
 */
export class AppDatabase {
  private readonly db: DatabaseSync

  constructor(filePath: string) {
    mkdirSync(dirname(filePath), { recursive: true })
    this.db = new DatabaseSync(filePath)
    this.db.exec('PRAGMA journal_mode = WAL')
    this.db.exec('PRAGMA foreign_keys = ON')
    runMigrations(this)
  }

  exec(sql: string): void {
    this.db.exec(sql)
  }

  run(sql: string, params: SqlValue[] = []): void {
    this.db.prepare(sql).run(...params)
  }

  get<T>(sql: string, params: SqlValue[] = []): T | undefined {
    return this.db.prepare(sql).get(...params) as T | undefined
  }

  all<T>(sql: string, params: SqlValue[] = []): T[] {
    return this.db.prepare(sql).all(...params) as T[]
  }

  close(): void {
    this.db.close()
  }
}

export type SqlValue = string | number | bigint | null | Uint8Array
