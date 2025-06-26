import type { HashingUtils } from '../types/database';

export class HashingUtilsImpl implements HashingUtils {
  /**
   * Generate a hash for the entire dataset
   * Used for cache invalidation and data fingerprinting
   */
  hashData(data: Record<string, unknown>[]): string {
    const normalized = this.normalizeData(data);
    const dataString = JSON.stringify(normalized, Object.keys(normalized).sort());
    return this.sha256(dataString);
  }

  /**
   * Generate a hash for a prompt
   * Used for cache lookup based on analysis prompt
   */
  hashPrompt(prompt: string): string {
    const normalized = prompt.trim().toLowerCase();
    return this.sha256(normalized);
  }

  /**
   * Generate a hash for data pattern (structure + sample values)
   * Used for cache lookup for similar data structures
   */
  hashDataPattern(data: Record<string, unknown>[], selectedColumns?: string[]): string {
    if (data.length === 0) return this.sha256('empty');

    // Get relevant columns
    const columns = selectedColumns || Object.keys(data[0]);
    
    // Create pattern from first few rows and column structure
    const pattern = {
      columns: columns.sort(),
      sample: data.slice(0, 3).map(row => {
        const relevantRow: Record<string, unknown> = {};
        columns.forEach(col => {
          relevantRow[col] = this.normalizeValue(row[col]);
        });
        return relevantRow;
      }),
      rowCount: data.length,
      columnCount: columns.length,
    };

    return this.sha256(JSON.stringify(pattern));
  }

  /**
   * Generate a hash for schema (column types and structure)
   * Used for detecting structural changes in data
   */
  hashSchema(columnNames: string[], sampleData: Record<string, unknown>[]): string {
    const schema = {
      columns: columnNames.sort(),
      types: this.inferColumnTypes(columnNames, sampleData),
    };

    return this.sha256(JSON.stringify(schema));
  }

  /**
   * Generate a unique ID for database records
   * Uses timestamp + random component for uniqueness
   */
  generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `${timestamp}-${random}`;
  }

  /**
   * Normalize data for consistent hashing
   * Sorts objects by keys, handles null/undefined consistently
   */
  private normalizeData(data: Record<string, unknown>[]): Record<string, unknown>[] {
    return data.map(row => {
      const normalized: Record<string, unknown> = {};
      const sortedKeys = Object.keys(row).sort();
      
      sortedKeys.forEach(key => {
        normalized[key] = this.normalizeValue(row[key]);
      });
      
      return normalized;
    });
  }

  /**
   * Normalize individual values for consistent comparison
   */
  private normalizeValue(value: unknown): unknown {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number') {
      // Handle floating point precision issues
      return Math.round(value * 1000000) / 1000000;
    }
    if (typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.map(v => this.normalizeValue(v));
    if (typeof value === 'object') {
      const normalized: Record<string, unknown> = {};
      Object.keys(value as object).sort().forEach(key => {
        normalized[key] = this.normalizeValue((value as any)[key]);
      });
      return normalized;
    }
    return value;
  }

  /**
   * Infer column types from sample data
   * Used for schema fingerprinting
   */
  private inferColumnTypes(columnNames: string[], sampleData: Record<string, unknown>[]): Record<string, string> {
    const types: Record<string, string> = {};

    columnNames.forEach(column => {
      const values = sampleData
        .map(row => row[column])
        .filter(v => v !== null && v !== undefined);

      if (values.length === 0) {
        types[column] = 'unknown';
        return;
      }

      // Check for consistent types
      const typeSet = new Set(values.map(v => typeof v));
      
      if (typeSet.size === 1) {
        const type = Array.from(typeSet)[0];
        
        // Further categorize numbers
        if (type === 'number') {
          const hasDecimals = values.some(v => (v as number) % 1 !== 0);
          types[column] = hasDecimals ? 'float' : 'integer';
        } else {
          types[column] = type;
        }
      } else if (typeSet.has('number') && typeSet.has('string')) {
        // Mixed number/string could be numeric with missing values
        types[column] = 'mixed_numeric';
      } else {
        types[column] = 'mixed';
      }

      // Special cases for common patterns
      if (types[column] === 'string') {
        const sampleValues = values.slice(0, 10) as string[];
        
        // Email pattern
        if (sampleValues.every(v => v.includes('@'))) {
          types[column] = 'email';
        }
        // Date-like pattern
        else if (sampleValues.every(v => /^\d{4}-\d{2}-\d{2}/.test(v))) {
          types[column] = 'date';
        }
        // URL pattern
        else if (sampleValues.every(v => v.startsWith('http'))) {
          types[column] = 'url';
        }
        // SMILES pattern (for chemical data)
        else if (sampleValues.every(v => /^[A-Za-z0-9\[\]()@+\-=#\\\/]+$/.test(v))) {
          types[column] = 'smiles';
        }
      }
    });

    return types;
  }

  /**
   * Simple SHA-256 implementation using Web Crypto API
   * Falls back to a simple hash for environments without crypto
   */
  private sha256(data: string): string {
    // In a real implementation, use Web Crypto API
    // For now, use a simple hash function
    return this.simpleHash(data);
  }

  /**
   * Simple hash function fallback
   * Not cryptographically secure but suitable for cache keys
   */
  private simpleHash(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString(36);
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36);
  }
}