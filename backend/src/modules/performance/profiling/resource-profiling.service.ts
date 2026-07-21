import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import {
  PerformanceObserver as NodePerformanceObserver,
  monitorEventLoopDelay,
} from 'node:perf_hooks';
import type { IntervalHistogram } from 'node:perf_hooks';

import { performanceConfig } from '../../../config/performance.config';
import type { ResourceProfile } from '../performance.types';

const NS_PER_MS = 1e6;

/**
 * Resource Profiling Service (P7.3) — profiles the Node process without any
 * external agent: event-loop lag (a high-resolution histogram from
 * `perf_hooks.monitorEventLoopDelay`), heap/RSS memory, CPU utilization
 * (sampled from `process.cpuUsage` + ELU), GC activity (a `PerformanceObserver`
 * on `gc` entries), uptime, and startup time. `snapshot()` is a pure read of the
 * accumulated histograms/counters — deterministic and cheap, safe to call at
 * scrape/report time. This is the reusable seam for "CPU/GC/event-loop/memory"
 * optimization: measure centrally, tune via config, never per-service.
 */
@Injectable()
export class ResourceProfilingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ResourceProfilingService.name);
  private readonly histogram: IntervalHistogram;
  private gcObserver: NodePerformanceObserver | undefined;
  private gcCount = 0;
  private gcTotalMs = 0;
  private lastCpu = process.cpuUsage();
  private lastCpuAtMs = Date.now();
  /** Set once the app finishes bootstrapping (see PerformanceModule). */
  private startupMs: number | null = null;

  constructor(
    @Inject(performanceConfig.KEY)
    private readonly config: ConfigType<typeof performanceConfig>,
  ) {
    // `resolution` in ms — the sampler records how late each tick fired.
    this.histogram = monitorEventLoopDelay({ resolution: 20 });
  }

  onModuleInit(): void {
    if (!this.config.enabled) {
      return;
    }
    this.histogram.enable();
    try {
      this.gcObserver = new NodePerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.gcCount += 1;
          this.gcTotalMs += entry.duration;
        }
      });
      this.gcObserver.observe({ entryTypes: ['gc'] });
    } catch (error) {
      // GC observation is best-effort (unavailable in some runtimes).
      this.logger.warn(`gc profiling unavailable: ${(error as Error).message}`);
    }
  }

  onModuleDestroy(): void {
    try {
      this.histogram.disable();
      this.gcObserver?.disconnect();
    } catch {
      // ignore teardown errors
    }
  }

  /** Record the measured process startup time (ms), called once after boot. */
  markStartup(ms: number): void {
    this.startupMs = Math.round(ms);
  }

  /** A deterministic point-in-time resource profile. */
  snapshot(): ResourceProfile {
    const mem = process.memoryUsage();
    return {
      uptimeSeconds: Math.round(process.uptime()),
      startupMs: this.startupMs,
      eventLoopLagMeanMs: round2(this.histogram.mean / NS_PER_MS),
      eventLoopLagP95Ms: round2(this.histogram.percentile(95) / NS_PER_MS),
      rssBytes: mem.rss,
      heapUsedBytes: mem.heapUsed,
      heapTotalBytes: mem.heapTotal,
      externalBytes: mem.external,
      cpuPercent: this.cpuPercent(),
      gcCount: this.gcCount,
      gcTotalMs: round2(this.gcTotalMs),
      activeHandles: this.activeHandleCount(),
    };
  }

  /** CPU utilization (%) since the previous snapshot, across all cores → 1 core basis. */
  private cpuPercent(): number {
    const now = Date.now();
    const usage = process.cpuUsage(this.lastCpu);
    const elapsedMs = Math.max(1, now - this.lastCpuAtMs);
    this.lastCpu = process.cpuUsage();
    this.lastCpuAtMs = now;
    const cpuMs = (usage.user + usage.system) / 1000;
    return round2((cpuMs / elapsedMs) * 100);
  }

  private activeHandleCount(): number {
    // `_getActiveHandles` is internal but stable; guarded for safety.
    const fn = (process as unknown as { _getActiveHandles?: () => unknown[] })._getActiveHandles;
    try {
      return typeof fn === 'function' ? fn.call(process).length : 0;
    } catch {
      return 0;
    }
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
