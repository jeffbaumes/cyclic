
export type BlobStorage = {
  save(name: string, data: Uint8Array): Promise<void>;
  load(name: string): Promise<Uint8Array>;
  list(): Promise<string[]>;
};
