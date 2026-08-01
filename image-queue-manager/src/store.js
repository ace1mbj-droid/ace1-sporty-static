import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const EMPTY_STATE = { projects: {}, jobs: {} };

export class JsonStore {
  constructor(path = process.env.QUEUE_DB_PATH || './data/queue.json') {
    this.path = path;
    this.writeChain = Promise.resolve();
  }

  async read() {
    try {
      return JSON.parse(await readFile(this.path, 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return structuredClone(EMPTY_STATE);
      throw error;
    }
  }

  async update(mutator) {
    this.writeChain = this.writeChain.then(async () => {
      const state = await this.read();
      const result = await mutator(state);
      await mkdir(dirname(this.path), { recursive: true });
      const temporary = `${this.path}.tmp`;
      await writeFile(temporary, JSON.stringify(state, null, 2));
      await rename(temporary, this.path);
      return result;
    });
    return this.writeChain;
  }
}
