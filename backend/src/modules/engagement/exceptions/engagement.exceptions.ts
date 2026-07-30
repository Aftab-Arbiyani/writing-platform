import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES, MAX_CLAPS_PER_USER_PER_PIECE, MAX_COMMENT_DEPTH } from '@qalam/shared';

import { AppException } from '../../../common/exceptions/app.exception';

/** Domain exceptions for social engagement (E7; docs 16 §3.4). */

// ── Comments ───────────────────────────────────────────────────────────────

export class CommentNotFoundException extends AppException {
  constructor() {
    super(ERROR_CODES.COMMENT_NOT_FOUND, 'No such comment.', HttpStatus.NOT_FOUND);
  }
}

export class CommentForbiddenException extends AppException {
  constructor(action: 'edit' | 'delete') {
    super(
      ERROR_CODES.COMMENT_FORBIDDEN,
      action === 'edit'
        ? 'You can only edit your own comments.'
        : 'You can only delete your own comments.',
      HttpStatus.FORBIDDEN,
    );
  }
}

export class CommentDepthExceededException extends AppException {
  constructor() {
    super(
      ERROR_CODES.COMMENT_DEPTH_EXCEEDED,
      `Replies can nest at most ${MAX_COMMENT_DEPTH} levels deep.`,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export class CommentDeletedException extends AppException {
  constructor() {
    super(
      ERROR_CODES.COMMENT_DELETED,
      'You cannot reply to a deleted comment.',
      HttpStatus.CONFLICT,
    );
  }
}

// ── Claps ────────────────────────────────────────────────────────────────

export class ClapLimitReachedException extends AppException {
  constructor() {
    super(
      ERROR_CODES.CLAP_LIMIT_REACHED,
      `You have reached the maximum of ${MAX_CLAPS_PER_USER_PER_PIECE} claps for this piece.`,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

// ── Collections ────────────────────────────────────────────────────────────

/**
 * Missing OR not-owned collection — collections are private, so a foreign
 * collection is reported as absent (404), never revealing it exists.
 */
export class CollectionNotFoundException extends AppException {
  constructor() {
    super(ERROR_CODES.COLLECTION_NOT_FOUND, 'No such collection.', HttpStatus.NOT_FOUND);
  }
}

export class CollectionNameTakenException extends AppException {
  constructor() {
    super(
      ERROR_CODES.COLLECTION_NAME_TAKEN,
      'You already have a collection with this name.',
      HttpStatus.CONFLICT,
    );
  }
}

export class CollectionPieceExistsException extends AppException {
  constructor() {
    super(
      ERROR_CODES.COLLECTION_PIECE_EXISTS,
      'This piece is already in the collection.',
      HttpStatus.CONFLICT,
    );
  }
}

export class CollectionPieceNotFoundException extends AppException {
  constructor() {
    super(
      ERROR_CODES.COLLECTION_PIECE_NOT_FOUND,
      'This piece is not in the collection.',
      HttpStatus.NOT_FOUND,
    );
  }
}

export class CollectionDefaultImmutableException extends AppException {
  constructor() {
    super(
      ERROR_CODES.COLLECTION_DEFAULT_IMMUTABLE,
      'The default "Favorites" collection cannot be renamed or deleted.',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

// ── Responses ────────────────────────────────────────────────────────────

export class ResponseToSelfException extends AppException {
  constructor() {
    super(
      ERROR_CODES.RESPONSE_TO_SELF,
      'A piece cannot respond to itself.',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export class ResponseAlreadyExistsException extends AppException {
  constructor() {
    super(
      ERROR_CODES.RESPONSE_ALREADY_EXISTS,
      'This piece already responds to another piece.',
      HttpStatus.CONFLICT,
    );
  }
}
