import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { authConfig } from '../../config/auth.config';
import { AuthService } from './auth.service';
import type { AuthResult, UserSummary } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleExchangeDto } from './dto/google-exchange.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import {
  AuthResponseDto,
  GoogleExchangeResponseDto,
  TokenResponseDto,
} from './dto/auth-response.dto';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import type { TokenContext, TokenPair } from './services/token.service';

const REFRESH_COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30d, matches JWT_REFRESH_TTL

/**
 * Auth HTTP surface (docs 05 §11, docs 13 §3). Thin (docs 16 §3.6): decorators →
 * DTO → service → response mapping. Web clients get the refresh token as an
 * httpOnly cookie scoped to `/api/v1/auth`; mobile clients (`X-Client: mobile`)
 * get it in the body (docs 13 §3.3). Rate-limit tiers are enforced by
 * `RateLimitGuard` (docs 13 §8); public routes opt out of the global
 * `JwtAuthGuard` via `@Public()`.
 */
@ApiTags('auth')
@Controller('auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Inject(authConfig.KEY) private readonly config: ConfigType<typeof authConfig>,
  ) {}

  @Post('register')
  @Public()
  @RateLimit('authRegister')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register with email + password (sends a verification email).' })
  @ApiCreatedResponse({ type: AuthResponseDto })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.register(dto, this.context(req));
    return this.deliverAuth(req, res, result);
  }

  @Post('login')
  @Public()
  @RateLimit('authLogin', 'authLoginHourly')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in with email + password.' })
  @ApiOkResponse({ type: AuthResponseDto })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.login(dto, this.context(req));
    return this.deliverAuth(req, res, result);
  }

  @Post('refresh')
  @Public()
  @RateLimit('authRefresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate the refresh token (cookie for web, body for mobile).' })
  @ApiOkResponse({ type: TokenResponseDto })
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TokenResponseDto> {
    const presented = this.readRefreshToken(req, dto.refreshToken);
    const tokens = await this.authService.refresh(presented ?? '', this.context(req));
    return this.deliverTokens(req, res, tokens);
  }

  @Post('logout')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke the current session.' })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logout(
      this.readRefreshToken(req, dto.refreshToken),
      user.id,
      this.context(req),
    );
    this.clearRefreshCookie(res);
  }

  @Post('logout-all')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke every session for the current user.' })
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logoutAll(user.id, this.context(req));
    this.clearRefreshCookie(res);
  }

  @Post('verify-email')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify an email address with the token from the link.' })
  @ApiOkResponse({ description: 'Email verified.' })
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<{ verified: true }> {
    await this.authService.verifyEmail(dto.token);
    return { verified: true };
  }

  @Post('resend-verification')
  @ApiBearerAuth()
  @RateLimit('authResendVerification')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Resend the verification email to the current user.' })
  async resendVerification(@CurrentUser() user: AuthenticatedUser): Promise<{ sent: true }> {
    await this.authService.resendVerification(user.id);
    return { sent: true };
  }

  @Post('forgot-password')
  @Public()
  @RateLimit('authPasswordReset')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Request a password-reset email (no account enumeration).' })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ sent: true }> {
    await this.authService.forgotPassword(dto.email);
    // Always 202 regardless of whether the email exists (docs 13 §3.1).
    return { sent: true };
  }

  @Post('reset-password')
  @Public()
  @RateLimit('authPasswordReset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set a new password using a reset token.' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() req: Request,
  ): Promise<{ reset: true }> {
    await this.authService.resetPassword(dto.token, dto.newPassword, this.context(req));
    return { reset: true };
  }

  @Post('change-password')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password (requires current password; revokes other sessions).' })
  @ApiOkResponse({ type: TokenResponseDto })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TokenResponseDto> {
    const tokens = await this.authService.changePassword(user.id, dto, this.context(req));
    return this.deliverTokens(req, res, tokens);
  }

  @Get('google')
  @Public()
  @ApiOperation({ summary: 'Start Google OAuth (redirects to Google consent).' })
  async google(@Res() res: Response): Promise<void> {
    const url = await this.authService.buildGoogleAuthUrl();
    res.redirect(url);
  }

  @Get('google/callback')
  @Public()
  @ApiOperation({
    summary: 'Google OAuth callback — sets refresh cookie, redirects with a one-time code.',
  })
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const { oneTimeCode, tokens } = await this.authService.handleGoogleCallback(
      code,
      state,
      this.context(req),
    );
    this.setRefreshCookie(res, tokens.refreshToken);
    // Deliver the token via a one-time code, never in the URL (docs 13 §13).
    res.redirect(`${this.config.appUrl}/auth/callback?code=${encodeURIComponent(oneTimeCode)}`);
  }

  @Post('google/exchange')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange the one-time OAuth code for an access token.' })
  @ApiOkResponse({ type: GoogleExchangeResponseDto })
  async googleExchange(@Body() dto: GoogleExchangeDto): Promise<GoogleExchangeResponseDto> {
    const accessToken = await this.authService.exchangeGoogleCode(dto.code);
    return { accessToken };
  }

  // ── helpers ────────────────────────────────────────────────────────────

  private context(req: Request): TokenContext {
    return { ip: req.ip ?? 'unknown', device: req.header('user-agent') ?? 'unknown' };
  }

  private isMobile(req: Request): boolean {
    return req.header('x-client')?.toLowerCase() === 'mobile';
  }

  private readRefreshToken(req: Request, bodyToken?: string): string | undefined {
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
    return cookies?.[this.config.refreshCookie.name] ?? bodyToken;
  }

  private deliverAuth(req: Request, res: Response, result: AuthResult): AuthResponseDto {
    const mobile = this.isMobile(req);
    if (!mobile) {
      this.setRefreshCookie(res, result.tokens.refreshToken);
    }
    return {
      user: result.user satisfies UserSummary,
      accessToken: result.tokens.accessToken,
      refreshToken: mobile ? result.tokens.refreshToken : undefined,
    };
  }

  private deliverTokens(req: Request, res: Response, tokens: TokenPair): TokenResponseDto {
    const mobile = this.isMobile(req);
    if (!mobile) {
      this.setRefreshCookie(res, tokens.refreshToken);
    }
    return {
      accessToken: tokens.accessToken,
      refreshToken: mobile ? tokens.refreshToken : undefined,
    };
  }

  private setRefreshCookie(res: Response, token: string): void {
    const { name, path, sameSite, secure, httpOnly } = this.config.refreshCookie;
    res.cookie(name, token, {
      httpOnly,
      secure,
      sameSite,
      path,
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    });
  }

  private clearRefreshCookie(res: Response): void {
    const { name, path } = this.config.refreshCookie;
    res.clearCookie(name, { path });
  }
}
