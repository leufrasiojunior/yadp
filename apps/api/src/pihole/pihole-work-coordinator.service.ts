import { Inject, Injectable, Logger } from "@nestjs/common";

import { normalizeManagedInstanceBaseUrl } from "../common/url/managed-instance-base-url";
import { AppEnvService } from "../config/app-env";
import type { PiholeConnection } from "./pihole.types";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";

type PiholeWorkJob = {
  id: number;
  operation: string;
  keys: string[];
  enqueuedAt: number;
  execute: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

type PiholeWorkContext = {
  keys: ReadonlySet<string>;
};

let piholeWorkSequence = 0;

@Injectable()
export class PiholeWorkCoordinatorService {
  private readonly logger = new Logger(PiholeWorkCoordinatorService.name);
  private readonly globalMaxConcurrency: number;
  private readonly perKeyMaxConcurrency: number;
  private readonly queue: PiholeWorkJob[] = [];
  private readonly activeKeyCounts = new Map<string, number>();
  private readonly contextStorage = new AsyncLocalStorage<PiholeWorkContext>();
  private runningCount = 0;
  private draining = false;

  constructor(@Inject(AppEnvService) env: AppEnvService) {
    this.globalMaxConcurrency = env.values.PIHOLE_GLOBAL_MAX_CONCURRENCY;
    this.perKeyMaxConcurrency = env.values.PIHOLE_PER_INSTANCE_MAX_CONCURRENCY;
  }

  runForConnection<T>(connection: PiholeConnection, operation: string, execute: () => Promise<T>) {
    return this.run({
      operation,
      keys: [this.buildTargetKey(connection)],
      execute,
    });
  }

  runForInstance<T>(instanceId: string, connection: PiholeConnection, operation: string, execute: () => Promise<T>) {
    return this.run({
      operation,
      keys: [this.buildInstanceKey(instanceId), this.buildTargetKey(connection)],
      execute,
    });
  }

  async run<T>(options: { operation: string; keys: string[]; execute: () => Promise<T> }): Promise<T> {
    const normalizedKeys = [...new Set(options.keys.map((key) => key.trim()).filter((key) => key.length > 0))].sort();

    if (normalizedKeys.length === 0) {
      return options.execute();
    }

    const context = this.contextStorage.getStore();

    if (context && normalizedKeys.every((key) => context.keys.has(key))) {
      this.logger.verbose(
        `Pi-hole work reused current lock operation=${options.operation} keys=${normalizedKeys.join(",")}.`,
      );
      return options.execute();
    }

    const jobId = ++piholeWorkSequence;

    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        id: jobId,
        operation: options.operation,
        keys: normalizedKeys,
        enqueuedAt: Date.now(),
        execute: () => options.execute(),
        resolve: (value) => resolve(value as T),
        reject,
      });

      this.logger.debug(
        `[work:${jobId}] queued operation=${options.operation} keys=${normalizedKeys.join(",")} globalRunning=${this.runningCount} queuedCount=${this.queue.length}`,
      );

      this.drainQueue();
    });
  }

  private drainQueue() {
    if (this.draining) {
      return;
    }

    this.draining = true;

    try {
      while (this.runningCount < this.globalMaxConcurrency) {
        const nextIndex = this.queue.findIndex((job) => this.canStart(job));

        if (nextIndex === -1) {
          return;
        }

        const [job] = this.queue.splice(nextIndex, 1);

        if (!job) {
          return;
        }

        this.startJob(job);
      }
    } finally {
      this.draining = false;
    }
  }

  private canStart(job: PiholeWorkJob) {
    return job.keys.every((key) => (this.activeKeyCounts.get(key) ?? 0) < this.perKeyMaxConcurrency);
  }

  private startJob(job: PiholeWorkJob) {
    this.runningCount += 1;

    for (const key of job.keys) {
      this.activeKeyCounts.set(key, (this.activeKeyCounts.get(key) ?? 0) + 1);
    }

    const waitMs = Date.now() - job.enqueuedAt;

    this.logger.debug(
      `[work:${job.id}] start operation=${job.operation} keys=${job.keys.join(",")} waitMs=${waitMs} runSlots=${this.runningCount} queuedCount=${this.queue.length}`,
    );

    void this.executeJob(job, waitMs);
  }

  private async executeJob(job: PiholeWorkJob, waitMs: number) {
    const startedAt = Date.now();

    try {
      const result = await this.contextStorage.run({ keys: new Set(job.keys) }, () => job.execute());
      job.resolve(result);
      this.logger.debug(
        `[work:${job.id}] success operation=${job.operation} keys=${job.keys.join(",")} waitMs=${waitMs} runMs=${Date.now() - startedAt} globalRunning=${this.runningCount} queuedCount=${this.queue.length}`,
      );
    } catch (error) {
      job.reject(error);
      this.logger.warn(
        `[work:${job.id}] failure operation=${job.operation} keys=${job.keys.join(",")} waitMs=${waitMs} runMs=${Date.now() - startedAt} globalRunning=${this.runningCount} queuedCount=${this.queue.length}`,
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.runningCount -= 1;

      for (const key of job.keys) {
        const nextCount = (this.activeKeyCounts.get(key) ?? 0) - 1;

        if (nextCount <= 0) {
          this.activeKeyCounts.delete(key);
        } else {
          this.activeKeyCounts.set(key, nextCount);
        }
      }

      this.drainQueue();
    }
  }

  private buildInstanceKey(instanceId: string) {
    return `instance:${instanceId}`;
  }

  private buildTargetKey(connection: PiholeConnection) {
    return `target:${normalizeManagedInstanceBaseUrl(connection.baseUrl)}:${this.buildTrustFingerprint(connection)}`;
  }

  private buildTrustFingerprint(connection: PiholeConnection) {
    const certificatePem = connection.certificatePem?.trim();

    if (certificatePem) {
      const fingerprint = createHash("sha256").update(certificatePem).digest("hex");
      return `custom-ca:${fingerprint}`;
    }

    if (connection.allowSelfSigned ?? false) {
      return "allow-self-signed";
    }

    return "strict";
  }
}
