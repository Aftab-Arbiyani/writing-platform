import { Body, Controller, Get, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { REQUEST_ID_HEADER } from '../../common/constants/http.constants';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import type { AuditContext } from '../audit/audit.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ConsentService } from './consent.service';
import { DataSubjectService } from './data-subject.service';
import { UpdateConsentDto } from './dto/update-consent.dto';
import type { ConsentEntry, DataExportBundle, DataSubjectRequestRecord } from './privacy.types';

/**
 * Self-service privacy endpoints (P7.2, GDPR). A signed-in user manages their
 * own consent and exercises data-access (export) + erasure rights. Auth is the
 * global default-deny guard; every action is rate-limited and immutably audited
 * by the underlying services. A user can only ever act on THEIR OWN data — the
 * subject id is taken from the JWT (`@CurrentUser`), never the request body.
 */
@ApiTags('privacy')
@ApiBearerAuth()
@Controller('me/privacy')
@UseGuards(RateLimitGuard)
export class PrivacyController {
  constructor(
    private readonly consent: ConsentService,
    private readonly dsr: DataSubjectService,
  ) {}

  private ctx(req: Request): AuditContext {
    const header = req.headers[REQUEST_ID_HEADER];
    return {
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
      requestId: (Array.isArray(header) ? header[0] : header) ?? null,
    };
  }

  @Get('consent')
  @RateLimit('apiDefault')
  @ApiOperation({ summary: 'Current consent state for every purpose.' })
  @ApiOkResponse({ description: 'Consent entries.' })
  getConsent(@CurrentUser() user: AuthenticatedUser): Promise<ConsentEntry[]> {
    return this.consent.getConsent(user.id);
  }

  @Put('consent')
  @RateLimit('write')
  @ApiOperation({ summary: 'Grant or withdraw a consent purpose.' })
  @ApiOkResponse({ description: 'Updated consent entries.' })
  async setConsent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateConsentDto,
    @Req() req: Request,
  ): Promise<ConsentEntry[]> {
    await this.consent.setConsent(user.id, dto.purpose, dto.granted, this.ctx(req));
    return this.consent.getConsent(user.id);
  }

  @Get('export')
  @RateLimit('write')
  @ApiOperation({ summary: 'Export all of my data (GDPR Art. 15).' })
  @ApiOkResponse({ description: 'The data-export bundle.' })
  export(@CurrentUser() user: AuthenticatedUser, @Req() req: Request): Promise<DataExportBundle> {
    return this.dsr.export(user.id, this.ctx(req));
  }

  @Post('erasure')
  @RateLimit('write')
  @ApiOperation({ summary: 'Request erasure of my data (GDPR Art. 17).' })
  @ApiOkResponse({ description: 'Erasure outcome per data domain.' })
  erase(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<{ erased: string[]; failed: string[] }> {
    return this.dsr.erase(user.id, this.ctx(req));
  }

  @Get('requests')
  @RateLimit('apiDefault')
  @ApiOperation({ summary: 'Status of my data-subject requests.' })
  @ApiOkResponse({ description: 'Latest request status per kind.' })
  requests(@CurrentUser() user: AuthenticatedUser): Promise<DataSubjectRequestRecord[]> {
    return this.dsr.status(user.id);
  }
}
