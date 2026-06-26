export const STORAGE = Symbol('STORAGE');

export interface StorageAdapter {
  put(key: string, body: Buffer, contentType: string): Promise<string>;
  delete(key: string): Promise<void>;
  keyFromUrl(url: string): string | null;
}
