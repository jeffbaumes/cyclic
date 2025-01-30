import { BlobStorage } from '../shared/storage';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as msgpack from '@msgpack/msgpack';

export const createFileBlobStorage = async (directory: string): Promise<BlobStorage> => {
  await fs.mkdir(directory, { recursive: true });
  const cache = new Map<string, any>();
  return {
    save: async (name: string, data: any): Promise<void> => {
      const filePath = path.join(directory, name);
      await fs.writeFile(filePath, msgpack.encode(data));
    },

    load: async (name: string): Promise<any> => {
      if (!cache.has(name)) {
        const filePath = path.join(directory, name);
        cache.set(name, msgpack.decode(await fs.readFile(filePath)));
      }
      return cache.get(name);
    },

    list: async (): Promise<string[]> => {
      return await fs.readdir(directory);
    },
  };
}
