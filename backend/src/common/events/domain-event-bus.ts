import { Injectable, Logger } from '@nestjs/common';

import type { DomainEventMap } from './domain-events';

type Handler<T> = (payload: T) => void | Promise<void>;

/**
 * A tiny in-process domain-event bus (E9) — deliberately dependency-free (no
 * `@nestjs/event-emitter`, no BullMQ) to keep the frozen-lockfile Docker build
 * stable and give full control over ordering + error isolation.
 *
 * Semantics:
 * - `emit` awaits every handler but is **error-isolated**: a handler that throws
 *   is logged and swallowed, so a notification failure can never break — or roll
 *   back — the domain action that emitted the event. Emitters call `emit` AFTER
 *   their transaction commits, so a durable action is never undone by a
 *   downstream side-effect (docs 16 §3.5 / TransactionRunner contract).
 * - Awaiting (rather than fire-and-forget) makes effects observable by the time
 *   the request returns — the unread count is immediately consistent and e2e
 *   tests are deterministic. Swapping to a BullMQ worker later (roadmap E9 t2)
 *   only changes this class, not its callers.
 *
 * Registered globally by {@link CommonModule}; feature modules inject it to emit,
 * and the notification listener injects it to subscribe.
 */
@Injectable()
export class DomainEventBus {
  private readonly logger = new Logger(DomainEventBus.name);
  private readonly handlers = new Map<string, Handler<unknown>[]>();

  /** Subscribe a handler to an event (type-safe on the event name). */
  on<K extends keyof DomainEventMap>(event: K, handler: Handler<DomainEventMap[K]>): void {
    const existing = this.handlers.get(event) ?? [];
    existing.push(handler as Handler<unknown>);
    this.handlers.set(event, existing);
  }

  /** Emit an event; awaits all handlers, isolating (logging) any that throw. */
  async emit<K extends keyof DomainEventMap>(event: K, payload: DomainEventMap[K]): Promise<void> {
    const handlers = this.handlers.get(event);
    if (handlers === undefined || handlers.length === 0) {
      return;
    }
    await Promise.all(
      handlers.map((handler) =>
        Promise.resolve()
          .then(() => handler(payload))
          .catch((error: unknown) => {
            const err = error as Error;
            this.logger.error(`handler for "${event}" failed: ${err.message}`, err.stack);
          }),
      ),
    );
  }
}
