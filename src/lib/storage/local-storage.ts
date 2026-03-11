import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { randomUUID } from "node:crypto";

type SaveBufferInput = {
  scope: string;
  fileName: string;
  content: Buffer;
};

type SaveBufferResult = {
  storageKey: string;
  absolutePath: string;
};

export function createLocalStorage(config: { rootDir: string }) {
  return {
    async saveBuffer(input: SaveBufferInput): Promise<SaveBufferResult> {
      const extension = extname(input.fileName) || ".bin";
      const storageKey = `${input.scope}/${randomUUID()}${extension}`;
      const absolutePath = join(config.rootDir, storageKey);

      await mkdir(join(config.rootDir, input.scope), { recursive: true });
      await writeFile(absolutePath, input.content);

      return {
        storageKey,
        absolutePath,
      };
    },
  };
}

export type LocalStorage = ReturnType<typeof createLocalStorage>;
