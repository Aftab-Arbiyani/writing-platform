import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '@qalam/shared';

import { AppException } from '../../../common/exceptions/app.exception';

/**
 * Domain exceptions for auth (docs 16 §3.4). Each carries a stable `@qalam/shared`
 * code and a meaningful HTTP status; the global filter renders the ADR §5
 * envelope. Messages are deliberately generic where enumeration is a risk
 * (docs 13 §3.1) — the same `AUTH_INVALID_CREDENTIALS` for wrong email or wrong
 * password, and forgot-password never reveals whether an account exists.
 */

export class InvalidCredentialsException extends AppException {
  constructor() {
    super(
      ERROR_CODES.AUTH_INVALID_CREDENTIALS,
      'Invalid email or password.',
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class EmailTakenException extends AppException {
  constructor() {
    super(ERROR_CODES.AUTH_EMAIL_TAKEN, 'That email is already registered.', HttpStatus.CONFLICT);
  }
}

export class UsernameTakenException extends AppException {
  constructor() {
    super(ERROR_CODES.USER_USERNAME_TAKEN, 'That username is already taken.', HttpStatus.CONFLICT);
  }
}

export class EmailUnverifiedException extends AppException {
  constructor() {
    super(
      ERROR_CODES.AUTH_EMAIL_UNVERIFIED,
      'Please verify your email address to continue.',
      HttpStatus.FORBIDDEN,
    );
  }
}

export class VerificationInvalidException extends AppException {
  constructor() {
    super(
      ERROR_CODES.AUTH_VERIFICATION_INVALID,
      'This verification link is invalid or has expired.',
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class EmailAlreadyVerifiedException extends AppException {
  constructor() {
    super(
      ERROR_CODES.AUTH_EMAIL_ALREADY_VERIFIED,
      'This email is already verified.',
      HttpStatus.CONFLICT,
    );
  }
}

export class ResetInvalidException extends AppException {
  constructor() {
    super(
      ERROR_CODES.AUTH_RESET_INVALID,
      'This password-reset link is invalid or has expired.',
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class PasswordWeakException extends AppException {
  constructor(reason = 'Password does not meet the security policy.') {
    super(ERROR_CODES.AUTH_PASSWORD_WEAK, reason, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

export class CurrentPasswordInvalidException extends AppException {
  constructor() {
    super(
      ERROR_CODES.AUTH_CURRENT_PASSWORD_INVALID,
      'Your current password is incorrect.',
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class TokenInvalidException extends AppException {
  constructor() {
    super(ERROR_CODES.AUTH_TOKEN_INVALID, 'Invalid or malformed token.', HttpStatus.UNAUTHORIZED);
  }
}

export class RefreshReusedException extends AppException {
  constructor() {
    super(
      ERROR_CODES.AUTH_REFRESH_REUSED,
      'Session ended for security reasons. Please sign in again.',
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class SessionRevokedException extends AppException {
  constructor() {
    super(
      ERROR_CODES.AUTH_SESSION_REVOKED,
      'This session has been revoked. Please sign in again.',
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class AccountSuspendedException extends AppException {
  constructor() {
    super(ERROR_CODES.AUTH_ACCOUNT_SUSPENDED, 'This account is suspended.', HttpStatus.FORBIDDEN);
  }
}

export class OAuthStateInvalidException extends AppException {
  constructor() {
    super(
      ERROR_CODES.AUTH_OAUTH_STATE_INVALID,
      'OAuth state is invalid or expired.',
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class OAuthFailedException extends AppException {
  constructor(message = 'Google sign-in failed.') {
    super(ERROR_CODES.AUTH_OAUTH_FAILED, message, HttpStatus.UNAUTHORIZED);
  }
}
