import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { StorageService } from '../services/storage';

export interface Session {
  id: string;
  name: string;
  description?: string;
  file_name?: string;
  file_type?: string;
  row_count: number;
  column_count: number;
  current_version: number;
  is_active: boolean;
  created_at: number;
  updated_at: number;
  last_activity_at: number;
}

export interface DataSnapshot {
  id: string;
  session_id: string;
  version: number;
  data: string; // JSON string
  data_hash: string;
  column_names: string; // JSON array
  change_description?: string;
  created_at: number;
  created_by: 'user' | 'ai';
}

export class SessionService {
  private storage?: StorageService;
  
  constructor(
    private db: D1Database,
    r2Bucket?: R2Bucket
  ) {
    if (r2Bucket) {
      this.storage = new StorageService(r2Bucket);
    }
  }

  async createSession(params: {
    name: string;
    description?: string;
    file_name?: string;
    file_type?: string;
    file_content?: ArrayBuffer | string;
    data: any[];
    column_names: string[];
  }): Promise<Session> {
    const sessionId = crypto.randomUUID();
    const now = Date.now();
    
    // Start a transaction
    const tx = await this.db.batch([
      this.db.prepare(`
        INSERT INTO sessions (
          id, name, description, file_name, file_type,
          row_count, column_count, current_version,
          created_at, updated_at, last_activity_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        sessionId,
        params.name,
        params.description || null,
        params.file_name || null,
        params.file_type || null,
        params.data.length,
        params.column_names.length,
        1,
        now,
        now,
        now
      ),
      
      this.db.prepare(`
        INSERT INTO data_snapshots (
          id, session_id, version, data, data_hash,
          column_names, change_description, created_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        sessionId,
        1,
        JSON.stringify(params.data),
        this.hashData(params.data),
        JSON.stringify(params.column_names),
        'Initial data upload',
        now,
        'user'
      )
    ]);
    
    // Upload file to R2 if provided
    if (params.file_content && params.file_name && this.storage) {
      try {
        await this.storage.uploadFile(
          sessionId,
          params.file_name,
          params.file_content,
          params.file_type || 'unknown'
        );
      } catch (error) {
        console.error('Failed to upload file to R2:', error);
        // Continue even if file upload fails
      }
    }
    
    return {
      id: sessionId,
      name: params.name,
      description: params.description,
      file_name: params.file_name,
      file_type: params.file_type,
      row_count: params.data.length,
      column_count: params.column_names.length,
      current_version: 1,
      is_active: true,
      created_at: now,
      updated_at: now,
      last_activity_at: now
    };
  }

  async listSessions(limit = 20, offset = 0): Promise<Session[]> {
    const result = await this.db.prepare(`
      SELECT * FROM sessions
      WHERE is_active = TRUE
      ORDER BY last_activity_at DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all<Session>();
    
    return result.results || [];
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const result = await this.db.prepare(`
      SELECT * FROM sessions WHERE id = ?
    `).bind(sessionId).first<Session>();
    
    return result || null;
  }

  async getSessionData(sessionId: string, version?: number): Promise<DataSnapshot | null> {
    let query;
    
    if (version) {
      query = this.db.prepare(`
        SELECT * FROM data_snapshots 
        WHERE session_id = ? AND version = ?
      `).bind(sessionId, version);
    } else {
      // Get latest version
      query = this.db.prepare(`
        SELECT * FROM data_snapshots 
        WHERE session_id = ?
        ORDER BY version DESC
        LIMIT 1
      `).bind(sessionId);
    }
    
    const result = await query.first<DataSnapshot>();
    return result || null;
  }

  async saveSnapshot(sessionId: string, data: any[], changeDescription: string, createdBy: 'user' | 'ai' = 'user'): Promise<number> {
    // Get current version
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');
    
    const newVersion = session.current_version + 1;
    const now = Date.now();
    
    // Get column names from previous snapshot
    const prevSnapshot = await this.getSessionData(sessionId);
    if (!prevSnapshot) throw new Error('No previous snapshot found');
    
    await this.db.batch([
      this.db.prepare(`
        INSERT INTO data_snapshots (
          id, session_id, version, data, data_hash,
          column_names, change_description, created_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        sessionId,
        newVersion,
        JSON.stringify(data),
        this.hashData(data),
        prevSnapshot.column_names,
        changeDescription,
        now,
        createdBy
      ),
      
      this.db.prepare(`
        UPDATE sessions 
        SET current_version = ?, updated_at = ?, last_activity_at = ?,
            row_count = ?
        WHERE id = ?
      `).bind(newVersion, now, now, data.length, sessionId)
    ]);
    
    return newVersion;
  }

  async updateSessionActivity(sessionId: string): Promise<void> {
    await this.db.prepare(`
      UPDATE sessions SET last_activity_at = ? WHERE id = ?
    `).bind(Date.now(), sessionId).run();
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.db.prepare(`
      UPDATE sessions SET is_active = FALSE WHERE id = ?
    `).bind(sessionId).run();
  }

  private hashData(data: any[]): string {
    // Simple hash for data comparison
    const str = JSON.stringify(data.slice(0, 10)); // First 10 rows
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }
}