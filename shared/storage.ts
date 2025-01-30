
export type BlobStorage = {
  save(name: string, data: any): Promise<void>;
  load(name: string): Promise<any>;
  list(): Promise<string[]>;
};
