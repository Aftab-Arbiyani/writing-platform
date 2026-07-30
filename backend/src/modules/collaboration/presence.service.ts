import { Injectable } from '@nestjs/common';
import { POLICY_ACTIONS, PRESENCE_TTL_SECONDS } from '@qalam/shared';
import type { PresenceState } from '@qalam/shared';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { PieceNotFoundException } from '../pieces/exceptions/pieces.exceptions';
import { PiecesService } from '../pieces/pieces.service';
import { PolicyEngineService } from '../policy';
import { subjectOf, storyResource } from './collaboration.policy';
import type { PresenceDto } from './dto/collaboration-response.dto';

interface PresenceEntry {
  userId: string;
  state: PresenceState;
  /** Epoch ms after which this entry is stale and dropped from the roster. */
  expiresAt: number;
}

/**
 * Ephemeral collaborator presence in a story workspace (AF6).
 *
 * AF6 seam: swap for Redis (RedisService, DB `cache`) — a single-process
 * in-memory {@link Map} with per-entry TTL for now, which keeps the module free
 * of a Redis dependency and is trivially testable. The public shape (heartbeat /
 * roster with {@link PRESENCE_TTL_SECONDS} expiry) already matches a Redis-backed
 * implementation, so the swap is internal.
 */
@Injectable()
export class PresenceService {
  private readonly rosters = new Map<string, Map<string, PresenceEntry>>();

  constructor(
    private readonly pieces: PiecesService,
    private readonly engine: PolicyEngineService,
  ) {}

  /**
   * Records/refreshes the caller's presence in a story. Authorized through the
   * engine (StoryView) so only participants of a story appear in its roster.
   */
  async heartbeat(
    storyId: string,
    user: AuthenticatedUser,
    state: PresenceState,
  ): Promise<PresenceDto[]> {
    const facts = await this.pieces.getStoryContext(storyId);
    if (facts === null) {
      throw new PieceNotFoundException();
    }
    await this.engine.assert({
      subject: subjectOf(user),
      action: POLICY_ACTIONS.StoryView,
      resource: storyResource(storyId, facts),
    });

    const roster = this.rosterMap(storyId);
    roster.set(user.id, {
      userId: user.id,
      state,
      expiresAt: Date.now() + PRESENCE_TTL_SECONDS * 1000,
    });
    return this.activeEntries(storyId);
  }

  /** Active collaborators in a story workspace (stale entries pruned). */
  roster(storyId: string): PresenceDto[] {
    return this.activeEntries(storyId);
  }

  private rosterMap(storyId: string): Map<string, PresenceEntry> {
    let roster = this.rosters.get(storyId);
    if (roster === undefined) {
      roster = new Map<string, PresenceEntry>();
      this.rosters.set(storyId, roster);
    }
    return roster;
  }

  private activeEntries(storyId: string): PresenceDto[] {
    const roster = this.rosters.get(storyId);
    if (roster === undefined) {
      return [];
    }
    const now = Date.now();
    const out: PresenceDto[] = [];
    for (const [userId, entry] of roster) {
      if (entry.expiresAt <= now) {
        roster.delete(userId);
        continue;
      }
      out.push({
        userId: entry.userId,
        state: entry.state,
        lastSeenAt: new Date(entry.expiresAt - PRESENCE_TTL_SECONDS * 1000).toISOString(),
      });
    }
    if (roster.size === 0) {
      this.rosters.delete(storyId);
    }
    return out;
  }
}
