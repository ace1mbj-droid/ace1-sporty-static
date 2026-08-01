import { randomUUID } from 'node:crypto';

export const JOB_STATUS = Object.freeze({
  PENDING: 'PENDING',
  GENERATING: 'GENERATING',
  QUALITY_CHECK: 'QUALITY_CHECK',
  COMPLETED: 'COMPLETED',
  RETRY_PENDING: 'RETRY_PENDING',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  FAILED: 'FAILED'
});

export const PROJECT_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  NEEDS_ATTENTION: 'NEEDS_ATTENTION',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
});

export class ImageQueue {
  constructor(store) {
    this.store = store;
  }

  async createProject({ name, jobs, maxAttempts = 3 }) {
    if (!name?.trim()) throw new Error('Project name is required');
    if (!Array.isArray(jobs) || jobs.length === 0) throw new Error('At least one image job is required');

    const projectId = randomUUID();
    const now = new Date().toISOString();

    await this.store.update((state) => {
      state.projects[projectId] = {
        id: projectId,
        name: name.trim(),
        status: PROJECT_STATUS.RUNNING,
        totalJobs: jobs.length,
        createdAt: now,
        updatedAt: now
      };

      jobs.forEach((input, index) => {
        const id = randomUUID();
        state.jobs[id] = {
          id,
          projectId,
          sequence: index + 1,
          purpose: input.purpose || `Image ${index + 1}`,
          prompt: input.prompt || '',
          referenceImages: input.referenceImages || [],
          requirements: input.requirements || [],
          status: JOB_STATUS.PENDING,
          attempts: 0,
          maxAttempts: input.maxAttempts || maxAttempts,
          output: null,
          error: null,
          createdAt: now,
          updatedAt: now
        };
      });
    });

    return this.getProject(projectId);
  }

  async getProject(projectId) {
    const state = await this.store.read();
    const project = state.projects[projectId];
    if (!project) return null;
    const jobs = Object.values(state.jobs)
      .filter((job) => job.projectId === projectId)
      .sort((a, b) => a.sequence - b.sequence);
    return { ...project, counts: countJobs(jobs), jobs };
  }

  async claimNext(projectId) {
    return this.store.update((state) => {
      const project = state.projects[projectId];
      if (!project || project.status !== PROJECT_STATUS.RUNNING) return null;

      const job = Object.values(state.jobs)
        .filter((item) => item.projectId === projectId)
        .filter((item) => [JOB_STATUS.PENDING, JOB_STATUS.RETRY_PENDING].includes(item.status))
        .sort((a, b) => a.sequence - b.sequence)[0];

      if (!job) return null;
      job.status = JOB_STATUS.GENERATING;
      job.attempts += 1;
      job.updatedAt = new Date().toISOString();
      return structuredClone(job);
    });
  }

  async setJobStatus(jobId, status, patch = {}) {
    return this.store.update((state) => {
      const job = state.jobs[jobId];
      if (!job) throw new Error(`Unknown job: ${jobId}`);
      Object.assign(job, patch, { status, updatedAt: new Date().toISOString() });
      const project = state.projects[job.projectId];
      project.updatedAt = job.updatedAt;
      return structuredClone(job);
    });
  }

  async refreshProjectStatus(projectId) {
    return this.store.update((state) => {
      const project = state.projects[projectId];
      if (!project) return null;
      const jobs = Object.values(state.jobs).filter((job) => job.projectId === projectId);
      const counts = countJobs(jobs);

      const trulyComplete =
        counts.completed === project.totalJobs &&
        counts.pending === 0 &&
        counts.generating === 0 &&
        counts.retryPending === 0 &&
        counts.qualityCheck === 0 &&
        counts.needsReview === 0 &&
        counts.failed === 0;

      if (trulyComplete) project.status = PROJECT_STATUS.COMPLETED;
      else if (counts.needsReview > 0 || counts.failed > 0) project.status = PROJECT_STATUS.NEEDS_ATTENTION;
      project.updatedAt = new Date().toISOString();
      return { ...structuredClone(project), counts };
    });
  }
}

export function countJobs(jobs) {
  const counts = {
    total: jobs.length,
    completed: 0,
    pending: 0,
    generating: 0,
    qualityCheck: 0,
    retryPending: 0,
    needsReview: 0,
    failed: 0
  };

  for (const job of jobs) {
    const key = {
      [JOB_STATUS.COMPLETED]: 'completed',
      [JOB_STATUS.PENDING]: 'pending',
      [JOB_STATUS.GENERATING]: 'generating',
      [JOB_STATUS.QUALITY_CHECK]: 'qualityCheck',
      [JOB_STATUS.RETRY_PENDING]: 'retryPending',
      [JOB_STATUS.NEEDS_REVIEW]: 'needsReview',
      [JOB_STATUS.FAILED]: 'failed'
    }[job.status];
    if (key) counts[key] += 1;
  }
  return counts;
}
