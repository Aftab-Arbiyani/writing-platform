import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { StoryRole } from '@qalam/shared';

import { PolicyEngineService } from '../policy';
import type { StoryMembershipPort } from '../policy/policy.types';
import { MembershipService } from './membership.service';

/**
 * The Policy Engine port adapter (AF6). Self-registers this module's membership
 * lookup with the engine at bootstrap so the engine can resolve a subject's story
 * role WITHOUT a compile-time dependency on collaboration (no cycle — the engine
 * stays central). The engine calls {@link getStoryRole} whenever a story-role
 * gated action is evaluated for a non-owner.
 */
@Injectable()
export class StoryMembershipProvider implements StoryMembershipPort, OnModuleInit {
  constructor(
    private readonly engine: PolicyEngineService,
    private readonly members: MembershipService,
  ) {}

  onModuleInit(): void {
    this.engine.registerMembershipPort(this);
  }

  getStoryRole(storyId: string, userId: string): Promise<StoryRole | null> {
    return this.members.getRole(storyId, userId);
  }
}
