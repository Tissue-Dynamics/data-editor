import type { R2Bucket } from '@cloudflare/workers-types';

export interface FileMetadata {
  sessionId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: number;
}

export class StorageService {
  constructor(private bucket: R2Bucket) {}

  /**
   * Upload a file to R2 storage
   */
  async uploadFile(
    sessionId: string,
    fileName: string,
    fileContent: ArrayBuffer | string,
    fileType: string
  ): Promise<string> {
    const key = this.generateFileKey(sessionId, fileName);
    
    const metadata: FileMetadata = {
      sessionId,
      fileName,
      fileType,
      fileSize: fileContent instanceof ArrayBuffer ? fileContent.byteLength : fileContent.length,
      uploadedAt: Date.now()
    };

    await this.bucket.put(key, fileContent, {
      customMetadata: metadata as any,
      httpMetadata: {
        contentType: this.getContentType(fileType)
      }
    });

    return key;
  }

  /**
   * Download a file from R2 storage
   */
  async downloadFile(key: string): Promise<{
    content: ArrayBuffer;
    metadata: FileMetadata;
  } | null> {
    const object = await this.bucket.get(key);
    
    if (!object) {
      return null;
    }

    const content = await object.arrayBuffer();
    const metadata = object.customMetadata as unknown as FileMetadata;

    return { content, metadata };
  }

  /**
   * Get file metadata without downloading content
   */
  async getFileMetadata(key: string): Promise<FileMetadata | null> {
    const object = await this.bucket.head(key);
    
    if (!object) {
      return null;
    }

    return object.customMetadata as unknown as FileMetadata;
  }

  /**
   * List all files for a session
   */
  async listSessionFiles(sessionId: string): Promise<{
    key: string;
    metadata: FileMetadata;
  }[]> {
    const prefix = `sessions/${sessionId}/`;
    const listed = await this.bucket.list({ prefix });
    
    const files = await Promise.all(
      listed.objects.map(async (obj) => {
        const metadata = await this.getFileMetadata(obj.key);
        return metadata ? { key: obj.key, metadata } : null;
      })
    );

    return files.filter((f): f is { key: string; metadata: FileMetadata } => f !== null);
  }

  /**
   * Delete a file
   */
  async deleteFile(key: string): Promise<void> {
    await this.bucket.delete(key);
  }

  /**
   * Delete all files for a session
   */
  async deleteSessionFiles(sessionId: string): Promise<void> {
    const files = await this.listSessionFiles(sessionId);
    
    if (files.length > 0) {
      await this.bucket.delete(files.map(f => f.key));
    }
  }

  /**
   * Generate a consistent file key
   */
  private generateFileKey(sessionId: string, fileName: string): string {
    // Clean filename to be URL-safe
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const timestamp = Date.now();
    return `sessions/${sessionId}/${timestamp}_${cleanFileName}`;
  }

  /**
   * Get appropriate content type for file
   */
  private getContentType(fileType: string): string {
    const contentTypes: Record<string, string> = {
      'csv': 'text/csv',
      'json': 'application/json',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'xls': 'application/vnd.ms-excel',
      'txt': 'text/plain'
    };

    return contentTypes[fileType.toLowerCase()] || 'application/octet-stream';
  }
}