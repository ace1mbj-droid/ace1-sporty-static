import { JOB_STATUS, PROJECT_STATUS } from './queue.js';

export class ImageWorker {
  constructor({ queue, generator, qualityChecker, onProgress = () => {} }) {
    this.queue = queue;
    this.generator = generator;
    this.qualityChecker = qualityChecker;
    this.onProgress = onProgress;
  }

  async run(projectId) {
    while (true) {
      const project = await this.queue.getProject(projectId);
      if (!project) throw new Error(`Unknown project: ${projectId}`);
      if ([PROJECT_STATUS.PAUSED, PROJECT_STATUS.CANCELLED, PROJECT_STATUS.COMPLETED, PROJECT_STATUS.NEEDS_ATTENTION].includes(project.status)) {
        return project;
      }

      const job = await this.queue.claimNext(projectId);
      if (!job) return this.queue.refreshProjectStatus(projectId);

      try {
        const output = await this.generator.generate(job);
        await this.queue.setJobStatus(job.id, JOB_STATUS.QUALITY_CHECK, { output, error: null });
        const review = await this.qualityChecker.check({ job, output });

        if (review.pass) {
          await this.queue.setJobStatus(job.id, JOB_STATUS.COMPLETED, {
            qualityScore: review.score ?? null,
            review,
            completedAt: new Date().toISOString()
          });
        } else if (job.attempts < job.maxAttempts) {
          await this.queue.setJobStatus(job.id, JOB_STATUS.RETRY_PENDING, {
            error: review.reason || 'Quality check failed',
            correctionPrompt: review.corrections || null,
            review
          });
        } else {
          await this.queue.setJobStatus(job.id, JOB_STATUS.NEEDS_REVIEW, {
            error: review.reason || 'Quality check failed after maximum attempts',
            review
          });
        }
      } catch (error) {
        const retryable = error.retryable !== false && job.attempts < job.maxAttempts;
        await this.queue.setJobStatus(
          job.id,
          retryable ? JOB_STATUS.RETRY_PENDING : JOB_STATUS.NEEDS_REVIEW,
          { error: error.message }
        );
      }

      const status = await this.queue.refreshProjectStatus(projectId);
      await this.onProgress(status);
      if (status.status !== PROJECT_STATUS.RUNNING) return this.queue.getProject(projectId);
    }
  }
}
