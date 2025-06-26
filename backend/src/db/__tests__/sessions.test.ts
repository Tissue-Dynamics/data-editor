import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionService } from '../sessions';
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';

// Mock D1 Database
const createMockD1Database = (): D1Database => {
  const data = new Map<string, any[]>();
  
  const createPreparedStatement = (sql: string): D1PreparedStatement => {
    const bindings: any[] = [];
    
    return {
      bind: (...values: any[]) => {
        bindings.push(...values);
        return createPreparedStatement(sql);
      },
      
      first: async <T = any>() => {
        if (sql.includes('SELECT * FROM sessions WHERE id = ?')) {
          const sessions = data.get('sessions') || [];
          return sessions.find(s => s.id === bindings[0]) as T;
        }
        if (sql.includes('SELECT * FROM data_snapshots')) {
          const snapshots = data.get('data_snapshots') || [];
          if (sql.includes('version = ?')) {
            return snapshots.find(s => s.session_id === bindings[0] && s.version === bindings[1]) as T;
          }
          return snapshots
            .filter(s => s.session_id === bindings[0])
            .sort((a, b) => b.version - a.version)[0] as T;
        }
        return null;
      },
      
      all: async <T = any>() => {
        if (sql.includes('SELECT * FROM sessions')) {
          const sessions = data.get('sessions') || [];
          return {
            results: sessions.filter(s => s.is_active).slice(bindings[1], bindings[0] + bindings[1]),
            success: true,
            meta: { duration: 0 }
          } as any;
        }
        return { results: [], success: true, meta: { duration: 0 } } as any;
      },
      
      run: async () => {
        if (sql.includes('INSERT INTO sessions')) {
          const sessions = data.get('sessions') || [];
          sessions.push({
            id: bindings[0],
            name: bindings[1],
            description: bindings[2],
            file_name: bindings[3],
            file_type: bindings[4],
            row_count: bindings[5],
            column_count: bindings[6],
            current_version: bindings[7],
            created_at: bindings[8],
            updated_at: bindings[9],
            last_activity_at: bindings[10],
            is_active: true
          });
          data.set('sessions', sessions);
        }
        if (sql.includes('INSERT INTO data_snapshots')) {
          const snapshots = data.get('data_snapshots') || [];
          snapshots.push({
            id: bindings[0],
            session_id: bindings[1],
            version: bindings[2],
            data: bindings[3],
            data_hash: bindings[4],
            column_names: bindings[5],
            change_description: bindings[6],
            created_at: bindings[7],
            created_by: bindings[8]
          });
          data.set('data_snapshots', snapshots);
        }
        if (sql.includes('UPDATE sessions SET is_active = FALSE')) {
          const sessions = data.get('sessions') || [];
          const session = sessions.find(s => s.id === bindings[0]);
          if (session) session.is_active = false;
        }
        return { success: true, meta: { duration: 0, last_row_id: 1 } } as any;
      },
      
      raw: async () => [],
    } as unknown as D1PreparedStatement;
  };
  
  return {
    prepare: (sql: string) => createPreparedStatement(sql),
    batch: async (statements: D1PreparedStatement[]) => {
      const results = await Promise.all(statements.map(s => s.run()));
      return results;
    },
    dump: async () => new ArrayBuffer(0),
    exec: async () => ({ success: true } as any),
  } as D1Database;
};

describe('SessionService', () => {
  let db: D1Database;
  let service: SessionService;
  
  beforeEach(() => {
    db = createMockD1Database();
    service = new SessionService(db);
  });
  
  describe('createSession', () => {
    it('should create a new session with initial snapshot', async () => {
      const testData = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 }
      ];
      
      const session = await service.createSession({
        name: 'Test Session',
        description: 'Test description',
        file_name: 'test.csv',
        file_type: 'csv',
        data: testData,
        column_names: ['name', 'age']
      });
      
      expect(session).toMatchObject({
        name: 'Test Session',
        description: 'Test description',
        file_name: 'test.csv',
        file_type: 'csv',
        row_count: 2,
        column_count: 2,
        current_version: 1,
        is_active: true
      });
      
      expect(session.id).toBeDefined();
      expect(session.created_at).toBeDefined();
    });
  });
  
  describe('listSessions', () => {
    it('should list active sessions', async () => {
      // Create some sessions
      await service.createSession({
        name: 'Session 1',
        data: [{ test: 1 }],
        column_names: ['test']
      });
      
      await service.createSession({
        name: 'Session 2',
        data: [{ test: 2 }],
        column_names: ['test']
      });
      
      const sessions = await service.listSessions();
      
      expect(sessions).toHaveLength(2);
      expect(sessions[0].name).toBe('Session 1');
      expect(sessions[1].name).toBe('Session 2');
    });
    
    it('should respect limit and offset', async () => {
      // Create multiple sessions
      for (let i = 0; i < 5; i++) {
        await service.createSession({
          name: `Session ${i}`,
          data: [{ test: i }],
          column_names: ['test']
        });
      }
      
      const sessions = await service.listSessions(2, 1);
      expect(sessions).toHaveLength(2);
    });
  });
  
  describe('getSession', () => {
    it('should retrieve a specific session', async () => {
      const created = await service.createSession({
        name: 'Test Session',
        data: [{ test: 1 }],
        column_names: ['test']
      });
      
      const session = await service.getSession(created.id);
      
      expect(session).toMatchObject({
        id: created.id,
        name: 'Test Session'
      });
    });
    
    it('should return null for non-existent session', async () => {
      const session = await service.getSession('non-existent');
      expect(session).toBeNull();
    });
  });
  
  describe('getSessionData', () => {
    it('should retrieve latest snapshot by default', async () => {
      const session = await service.createSession({
        name: 'Test',
        data: [{ value: 1 }],
        column_names: ['value']
      });
      
      const snapshot = await service.getSessionData(session.id);
      
      expect(snapshot).toBeDefined();
      expect(snapshot!.version).toBe(1);
      expect(JSON.parse(snapshot!.data)).toEqual([{ value: 1 }]);
    });
    
    it('should retrieve specific version', async () => {
      const session = await service.createSession({
        name: 'Test',
        data: [{ value: 1 }],
        column_names: ['value']
      });
      
      await service.saveSnapshot(
        session.id,
        [{ value: 2 }],
        'Updated value'
      );
      
      const snapshot1 = await service.getSessionData(session.id, 1);
      const snapshot2 = await service.getSessionData(session.id, 2);
      
      expect(JSON.parse(snapshot1!.data)).toEqual([{ value: 1 }]);
      expect(JSON.parse(snapshot2!.data)).toEqual([{ value: 2 }]);
    });
  });
  
  describe('saveSnapshot', () => {
    it('should create a new snapshot with incremented version', async () => {
      const session = await service.createSession({
        name: 'Test',
        data: [{ value: 1 }],
        column_names: ['value']
      });
      
      const newVersion = await service.saveSnapshot(
        session.id,
        [{ value: 2 }],
        'User updated value',
        'user'
      );
      
      expect(newVersion).toBe(2);
      
      const snapshot = await service.getSessionData(session.id);
      expect(snapshot!.version).toBe(2);
      expect(snapshot!.change_description).toBe('User updated value');
      expect(snapshot!.created_by).toBe('user');
    });
  });
  
  describe('deleteSession', () => {
    it('should soft delete a session', async () => {
      const session = await service.createSession({
        name: 'Test',
        data: [{ test: 1 }],
        column_names: ['test']
      });
      
      await service.deleteSession(session.id);
      
      // Session should still exist but be marked inactive
      const deleted = await service.getSession(session.id);
      expect(deleted).toBeDefined();
      
      // Should not appear in list
      const sessions = await service.listSessions();
      expect(sessions.find(s => s.id === session.id)).toBeUndefined();
    });
  });
});