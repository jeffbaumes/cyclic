import { BlobStorage } from '../shared/storage';
import { promises as fs } from 'fs';
import * as path from 'path';

export const createFileBlobStorage = async (directory: string): Promise<BlobStorage> => {
  await fs.mkdir(directory, { recursive: true });
  return {
    save: async (name: string, data: Uint8Array): Promise<void> => {
      const filePath = path.join(directory, name);
      await fs.writeFile(filePath, data);
    },

    load: async (name: string): Promise<Uint8Array> => {
      const filePath = path.join(directory, name);
      return await fs.readFile(filePath);
    },

    list: async (): Promise<string[]> => {
      return await fs.readdir(directory);
    },
  };
}
