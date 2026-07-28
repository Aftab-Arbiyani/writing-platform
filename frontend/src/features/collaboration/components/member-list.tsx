import {
  ASSIGNABLE_STORY_ROLES,
  POLICY_ACTIONS,
  StoryRole,
  type StoryRole as Role,
} from '@qalam/shared';
import { QButton, QCard, QSelect } from '@qalam/ui';
import type { ReactElement } from 'react';

import { useMe } from '@/hooks/use-me';

import { useMemberActions } from '../hooks/use-members';
import type { StoryMember } from '../types/collaboration.types';
import { CapabilityGate } from './capability-gate';
import { CollaboratorIdentity } from './collaborator-identity';
import { RoleBadge } from './role-badge';

/**
 * The story's collaborator roster (AF6, W3a) — mobile's `_MemberTile` list.
 *
 * Management affordances are wrapped in `CapabilityGate`, so the roster is readable by anyone who
 * can view the story and actionable only for whoever the Policy Engine says may act. The owner row
 * carries no controls at all: `owner` is synthesised from the piece author, cannot be reassigned by
 * this surface (`story.transfer` is its own action, out of W3a's scope), and cannot be removed.
 */
const ROLE_OPTIONS = ASSIGNABLE_STORY_ROLES.map((role) => ({
  value: role,
  label:
    role === StoryRole.CoAuthor
      ? 'Co-author'
      : role === StoryRole.Editor
        ? 'Editor'
        : role === StoryRole.Reviewer
          ? 'Reviewer'
          : 'Beta reader',
}));

export interface MemberListProps {
  storyId: string;
  members: StoryMember[];
  /** The story author's username, when known — lets the owner row show a real name. */
  ownerUsername?: string;
}

export function MemberList({ storyId, members, ownerUsername }: MemberListProps): ReactElement {
  const { data: me } = useMe();
  const { changeRole, removeMember, leave } = useMemberActions(storyId);

  return (
    <ul className="flex flex-col gap-3">
      {members.map((member) => {
        const isSelf = member.userId === me?.id;
        const isOwner = member.role === StoryRole.Owner;

        return (
          <li key={member.userId}>
            <QCard>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CollaboratorIdentity
                  userId={member.userId}
                  username={isOwner ? ownerUsername : undefined}
                  isSelf={isSelf}
                />

                <div className="flex flex-wrap items-center gap-2">
                  <RoleBadge role={member.role} />

                  {isOwner ? null : (
                    <>
                      <CapabilityGate storyId={storyId} action={POLICY_ACTIONS.StoryManageRoles}>
                        <QSelect
                          // The select IS the control, so its accessible name must carry the row's
                          // identity — otherwise every row exposes the same name and neither a
                          // screen reader nor the E2E selector policy can tell them apart.
                          aria-label={`Change role for ${member.userId}`}
                          value={member.role}
                          options={ROLE_OPTIONS}
                          loading={changeRole.isPending}
                          // AntD's Select types `value` as `unknown`; the cast is safe because
                          // `options` is built from ASSIGNABLE_STORY_ROLES, so nothing else can
                          // reach this handler.
                          onChange={(role) =>
                            changeRole.mutate({ userId: member.userId, role: role as Role })
                          }
                        />
                      </CapabilityGate>

                      {isSelf ? (
                        <QButton
                          variant="secondary"
                          size="sm"
                          loading={leave.isPending}
                          onClick={() => leave.mutate()}
                        >
                          Leave story
                        </QButton>
                      ) : (
                        <CapabilityGate
                          storyId={storyId}
                          action={POLICY_ACTIONS.StoryManageMembers}
                        >
                          <QButton
                            variant="secondary"
                            size="sm"
                            loading={removeMember.isPending}
                            onClick={() => removeMember.mutate(member.userId)}
                          >
                            Remove
                          </QButton>
                        </CapabilityGate>
                      )}
                    </>
                  )}
                </div>
              </div>
            </QCard>
          </li>
        );
      })}
    </ul>
  );
}
