import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageService } from '../storage';
import type { R2Bucket, R2Object } from '@cloudflare/workers-types';

// Mock R2 bucket
const createMockR2Bucket = (): R2Bucket => {
  const storage = new Map<string, { content: ArrayBuffer; metadata: any }>();
  
  return {
    put: vi.fn(async (key: string, value: ArrayBuffer | string, options?: any) => {
      const content = typeof value === 'string' 
        ? new TextEncoder().encode(value) 
        : value as ArrayBuffer;
      
      storage.set(key, {
        content,
        metadata: options?.customMetadata || {}
      });
      
      return null as any;
    }),
    
    get: vi.fn(async (key: string) => {
      const item = storage.get(key);
      if (!item) return null;
      
      return {
        arrayBuffer: async () => item.content,
        customMetadata: item.metadata,
        body: null as any,
        bodyUsed: false,
        text: async () => new TextDecoder().decode(item.content),
        json: async () => JSON.parse(new TextDecoder().decode(item.content)),
      } as unknown as R2Object;
    }),
    
    head: vi.fn(async (key: string) => {
      const item = storage.get(key);
      if (!item) return null;
      
      return {
        customMetadata: item.metadata
      } as any;
    }),
    
    list: vi.fn(async (options?: any) => {
      const prefix = options?.prefix || '';
      const objects = Array.from(storage.keys())
        .filter(key => key.startsWith(prefix))
        .map(key => ({ key }));
      
      return {
        objects,
        truncated: false,
        cursor: undefined,
        delimitedPrefixes: []
      } as any;
    }),
    
    delete: vi.fn(async (keys: string | string[]) => {
      const keysArray = Array.isArray(keys) ? keys : [keys];
      keysArray.forEach(key => storage.delete(key));
    }),
  } as unknown as R2Bucket;
};

describe('StorageService', () => {
  let bucket: R2Bucket;
  let service: StorageService;
  
  beforeEach(() => {
    bucket = createMockR2Bucket();
    service = new StorageService(bucket);
  });
  
  describe('uploadFile', () => {
    it('should upload a file with proper metadata', async () => {
      const sessionId = 'test-session';
      const fileName = 'test.csv';
      const content = 'name,value\ntest,123';
      
      const key = await service.uploadFile(sessionId, fileName, content, 'csv');
      
      expect(bucket.put).toHaveBeenCalledWith(
        expect.stringContaining(`sessions/${sessionId}/`),
        content,
        expect.objectContaining({
          customMetadata: expect.objectContaining({
            sessionId,
            fileName,
            fileType: 'csv',
            fileSize: content.length
          }),
          httpMetadata: {
            contentType: 'text/csv'
          }
        })
      );
      
      expect(key).toMatch(/^sessions\/test-session\/\d+_test.csv$/);
    });
    
    it('should handle ArrayBuffer content', async () => {
      const content = new Uint8Array([1, 2, 3, 4]).buffer;
      
      const key = await service.uploadFile('session1', 'data.bin', content, 'bin');
      
      expect(bucket.put).toHaveBeenCalledWith(
        expect.any(String),
        content,
        expect.objectContaining({
          customMetadata: expect.objectContaining({
            fileSize: 4
          })
        })
      );
    });
    
    it('should sanitize file names', async () => {
      const key = await service.uploadFile(
        'session1',
        'my file (with spaces).csv',
        'data',
        'csv'
      );
      
      expect(key).toMatch(/_my_file__with_spaces_.csv$/);
    });
  });
  
  describe('downloadFile', () => {
    it('should download a file with metadata', async () => {
      const content = 'test content';
      const key = await service.uploadFile('session1', 'test.txt', content, 'txt');
      
      const result = await service.downloadFile(key);
      
      expect(result).not.toBeNull();
      expect(new TextDecoder().decode(result!.content)).toBe(content);
      expect(result!.metadata).toMatchObject({
        sessionId: 'session1',
        fileName: 'test.txt',
        fileType: 'txt'
      });
    });
    
    it('should return null for non-existent file', async () => {
      const result = await service.downloadFile('non-existent-key');
      expect(result).toBeNull();
    });
  });
  
  describe('listSessionFiles', () => {
    it('should list all files for a session', async () => {
      await service.uploadFile('session1', 'file1.csv', 'data1', 'csv');
      await service.uploadFile('session1', 'file2.json', 'data2', 'json');
      await service.uploadFile('session2', 'file3.csv', 'data3', 'csv');
      
      const files = await service.listSessionFiles('session1');
      
      expect(files).toHaveLength(2);
      expect(files[0].metadata.fileName).toBe('file1.csv');
      expect(files[1].metadata.fileName).toBe('file2.json');
    });
  });
  
  describe('deleteSessionFiles', () => {
    it('should delete all files for a session', async () => {
      await service.uploadFile('session1', 'file1.csv', 'data1', 'csv');
      await service.uploadFile('session1', 'file2.json', 'data2', 'json');
      
      await service.deleteSessionFiles('session1');
      
      const files = await service.listSessionFiles('session1');
      expect(files).toHaveLength(0);
    });
  });
});