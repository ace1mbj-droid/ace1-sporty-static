import { nextRunnableItem, summarize } from './queue-store.js';

export class QueueRunner {
  constructor({ store, generator, logger = console }) {
    this.store = store;
    this.generator = generator;
    this.logger = logger;
    this.running = false;
    this.stopRequested = false;
  }

  async start() {
    if (this.running) return this.status();
    this.running = true;
    this.stopRequested = false;

    try {
      await this.store.update((queue) => {
        queue.status = 'running';
        for (const item of queue.items) {
          if (item.state === 'generating') item.state = 'retry';
        }
      });

      while (!this.stopRequested) {
        const queue = await this.store.load();
        const item = nextRunnableItem(queue);
        if (!item) break;
        await this.processItem(item.id);
      }

      await this.store.update((queue) => {
        const summary = summarize(queue);
        queue.status = this.stopRequested
          ? 'paused'
          : summary.failed > 0
            ? 'completed_with_failures'
            : 'completed';
      });
    } finally {
      this.running = false;
    }

    return this.status();
  }

  stop() {
    this.stopRequested = true;
  }

  async status() {
    const queue = await this.store.load();
    return { ...summarize(queue), items: queue.items, running: this.running };
  }

  async processItem(itemId) {
    let snapshot;
    await this.store.update((queue) => {
      const item = queue.items.find((entry) => entry.id === itemId);
      if (!item) throw new Error(`Queue item ${itemId} was not found.`);
      item.state = 'generating';
      item.attempts += 1;
      item.startedAt = new Date().toISOString();
      item.error = null;
      snapshot = structuredClone(item);
    });

    try {
      this.logger.info(`Generating ${snapshot.id}: ${snapshot.title}`);
      const result = await this.generator.generate(snapshot);
      await this.store.update((queue) => {
        const item = queue.items.find((entry) => entry.id === itemId);
        item.state = 'completed';
        item.outputPath = result.outputPath;
        item.completedAt = new Date().toISOString();
        item.error = null;
      });
    } catch (error) {
      await this.store.update((queue) => {
        const item = queue.items.find((entry) => entry.id === itemId);
        item.error = error instanceof Error ? error.message : String(error);
        item.state = item.attempts <= queue.maxRetries ? 'retry' : 'failed';
      });
      this.logger.error(`Generation failed for ${snapshot.id}: ${error.message}`);
    }
  }
}
