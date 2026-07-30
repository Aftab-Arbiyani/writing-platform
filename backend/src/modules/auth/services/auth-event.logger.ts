import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

/**
 * Structured auth audit events (docs 14 event taxonomy; docs 13 §11). The
 * persistent `audit_logs` table is scoped to admin mutations + admin-account
 * logins (E10); ordinary auth events are recorded here as dot-cased structured
 * log lines carrying the request-correlated `userId`/`ip` — **never** a password,
 * token, or full email (docs 13 §13 redaction).
 *
 * `reuse_detected` is logged at warn level so it trips the alerting threshold
 * (docs 14 §8).
 */
@Injectable()
export class AuthEventLogger {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(AuthEventLogger.name);
  }

  register(userId: string, ip: string): void {
    this.emit('auth.register', { userId, ip });
  }
  loginSuccess(userId: string, ip: string): void {
    this.emit('auth.login.success', { userId, ip });
  }
  loginFailure(ip: string): void {
    // No userId/email — failures must not confirm which account was targeted.
    this.emit('auth.login.failure', { ip });
  }
  logout(userId: string, ip: string): void {
    this.emit('auth.logout', { userId, ip });
  }
  logoutAll(userId: string, ip: string): void {
    this.emit('auth.logout_all', { userId, ip });
  }
  emailVerified(userId: string): void {
    this.emit('auth.email.verified', { userId });
  }
  passwordChanged(userId: string, ip: string): void {
    this.emit('auth.password.changed', { userId, ip });
  }
  passwordReset(userId: string, ip: string): void {
    this.emit('auth.password.reset', { userId, ip });
  }
  googleLogin(userId: string, ip: string, linked: boolean): void {
    this.emit('auth.google.login', { userId, ip, linked });
  }
  refreshReuseDetected(userId: string, familyId: string, ip: string): void {
    this.logger.warn({ event: 'auth.token.reuse_detected', userId, familyId, ip });
  }

  private emit(event: string, fields: Record<string, unknown>): void {
    this.logger.info({ event, ...fields });
  }
}
