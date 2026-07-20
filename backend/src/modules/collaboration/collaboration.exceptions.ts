import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '@qalam/shared';

import { AppException } from '../../common/exceptions/app.exception';

/**
 * Domain exceptions for collaboration (AF6). Services throw these; the global
 * `AllExceptionsFilter` maps them onto the error envelope. Authorization denials
 * are NOT here — those come from the Policy Engine (`PolicyDeniedException`); a
 * collaboration exception is a business-rule violation (limits, lifecycle,
 * existence), never a permission check.
 */

/** No membership row for this user on this story (404). */
export class StoryMembershipNotFoundException extends AppException {
  constructor() {
    super(
      ERROR_CODES.STORY_MEMBERSHIP_NOT_FOUND,
      'That collaborator is not a member of this story.',
      HttpStatus.NOT_FOUND,
    );
  }
}

/** The user is already a collaborator on this story (409). */
export class StoryMemberExistsException extends AppException {
  constructor() {
    super(
      ERROR_CODES.STORY_MEMBER_EXISTS,
      'That user is already a collaborator on this story.',
      HttpStatus.CONFLICT,
    );
  }
}

/** Adding a collaborator would exceed MAX_STORY_COLLABORATORS (409). */
export class StoryCollaboratorLimitException extends AppException {
  constructor(max: number) {
    super(
      ERROR_CODES.STORY_COLLABORATOR_LIMIT,
      `This story already has the maximum of ${max} collaborators.`,
      HttpStatus.CONFLICT,
    );
  }
}

/** The requested story role is not assignable via the collaboration APIs (403). */
export class StoryRoleForbiddenException extends AppException {
  constructor(message = 'That story role cannot be assigned.') {
    super(ERROR_CODES.STORY_ROLE_FORBIDDEN, message, HttpStatus.FORBIDDEN);
  }
}

/** The story owner's role/membership cannot be changed via these APIs (409). */
export class StoryOwnerImmutableException extends AppException {
  constructor() {
    super(
      ERROR_CODES.STORY_OWNER_IMMUTABLE,
      "The story owner's role cannot be changed or removed here.",
      HttpStatus.CONFLICT,
    );
  }
}

/** No such invitation, or not the caller's (privacy-preserving 404). */
export class InvitationNotFoundException extends AppException {
  constructor() {
    super(ERROR_CODES.INVITATION_NOT_FOUND, 'No such invitation.', HttpStatus.NOT_FOUND);
  }
}

/** The invitation window has elapsed (409). */
export class InvitationExpiredException extends AppException {
  constructor() {
    super(ERROR_CODES.INVITATION_EXPIRED, 'This invitation has expired.', HttpStatus.CONFLICT);
  }
}

/** Accept/decline attempted on an invitation that is no longer pending (409). */
export class InvitationAlreadyRespondedException extends AppException {
  constructor() {
    super(
      ERROR_CODES.INVITATION_ALREADY_RESPONDED,
      'This invitation has already been responded to.',
      HttpStatus.CONFLICT,
    );
  }
}

/** The caller is not the invitee of this invitation (403). */
export class InvitationNotInviteeException extends AppException {
  constructor() {
    super(
      ERROR_CODES.INVITATION_NOT_INVITEE,
      'This invitation was not addressed to you.',
      HttpStatus.FORBIDDEN,
    );
  }
}

/** A user cannot invite themselves to a story (409). */
export class InvitationSelfException extends AppException {
  constructor() {
    super(
      ERROR_CODES.INVITATION_SELF,
      'You cannot invite yourself to a story.',
      HttpStatus.CONFLICT,
    );
  }
}

/** No such collaboration comment (privacy-preserving 404). */
export class CollabCommentNotFoundException extends AppException {
  constructor() {
    super(ERROR_CODES.COLLAB_COMMENT_NOT_FOUND, 'No such comment.', HttpStatus.NOT_FOUND);
  }
}

/** Acting on a comment the caller may not touch — reserved for non-policy cases (403). */
export class CollabCommentForbiddenException extends AppException {
  constructor() {
    super(
      ERROR_CODES.COLLAB_COMMENT_FORBIDDEN,
      'You cannot act on this comment.',
      HttpStatus.FORBIDDEN,
    );
  }
}

/** Replying to / resolving a comment thread that is already resolved (409). */
export class CollabCommentResolvedException extends AppException {
  constructor() {
    super(
      ERROR_CODES.COLLAB_COMMENT_RESOLVED,
      'This comment thread is already resolved.',
      HttpStatus.CONFLICT,
    );
  }
}

/** No such suggestion (privacy-preserving 404). */
export class SuggestionNotFoundException extends AppException {
  constructor() {
    super(ERROR_CODES.SUGGESTION_NOT_FOUND, 'No such suggestion.', HttpStatus.NOT_FOUND);
  }
}

/** Acting on a suggestion the caller may not resolve/withdraw — non-policy cases (403). */
export class SuggestionForbiddenException extends AppException {
  constructor() {
    super(
      ERROR_CODES.SUGGESTION_FORBIDDEN,
      'You cannot act on this suggestion.',
      HttpStatus.FORBIDDEN,
    );
  }
}

/** Accept/reject attempted on a suggestion that is no longer pending (409). */
export class SuggestionAlreadyResolvedException extends AppException {
  constructor() {
    super(
      ERROR_CODES.SUGGESTION_ALREADY_RESOLVED,
      'This suggestion has already been resolved.',
      HttpStatus.CONFLICT,
    );
  }
}

/** The suggestion's anchor text no longer matches the story content (409). */
export class SuggestionConflictException extends AppException {
  constructor() {
    super(
      ERROR_CODES.SUGGESTION_CONFLICT,
      'The story text has changed since this suggestion was made.',
      HttpStatus.CONFLICT,
    );
  }
}
