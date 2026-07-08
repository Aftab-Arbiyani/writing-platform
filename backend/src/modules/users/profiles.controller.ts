import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PERMISSIONS } from '@qalam/shared';
import type { Request } from 'express';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Permissions } from '../permissions/permissions.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { MediaKeyResponseDto, ProfileResponseDto } from './dto/profile-response.dto';
import { ProfileService } from './profile.service';

/** Hard ceiling for the raw upload; per-kind caps (5/10 MB) are enforced in ImageService. */
const UPLOAD_MAX_BYTES = 15 * 1024 * 1024;

/**
 * Profile HTTP surface (docs 05, docs 13 §4.2/§4.3). `/me` + uploads are
 * authenticated (global JwtAuthGuard); `/users/:username` is `@Public()` with
 * `OptionalAuthGuard` so anonymous viewers see public profiles and the service
 * receives the viewer (or null) to apply the private-account teaser rule.
 */
@ApiTags('profiles')
@Controller()
export class ProfilesController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current user’s own profile.' })
  @ApiOkResponse({ type: ProfileResponseDto })
  getMe(@CurrentUser() user: AuthenticatedUser): Promise<ProfileResponseDto> {
    return this.profileService.getOwnProfile(user.id);
  }

  @Patch('me')
  @ApiBearerAuth()
  @Permissions(PERMISSIONS.ProfileUpdate)
  @ApiOperation({
    summary:
      'Update the current user’s profile (bio, links, genres, privacy, …). Requires `profile.update`.',
  })
  @ApiOkResponse({ type: ProfileResponseDto })
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    return this.profileService.updateOwnProfile(user.id, dto);
  }

  @Post('profile/avatar')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Permissions(PERMISSIONS.ProfileUpdate)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @ApiOperation({
    summary: 'Upload/replace the avatar (JPEG/PNG/WebP, ≤5 MB; re-encoded to WebP).',
  })
  @ApiOkResponse({ type: MediaKeyResponseDto })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: UPLOAD_MAX_BYTES } }))
  uploadAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<MediaKeyResponseDto> {
    return this.profileService.updateAvatar(user.id, toUploaded(file));
  }

  @Post('profile/cover')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Permissions(PERMISSIONS.ProfileUpdate)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @ApiOperation({ summary: 'Upload/replace the cover image (JPEG/PNG/WebP, ≤10 MB).' })
  @ApiOkResponse({ type: MediaKeyResponseDto })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: UPLOAD_MAX_BYTES } }))
  uploadCover(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<MediaKeyResponseDto> {
    return this.profileService.updateCover(user.id, toUploaded(file));
  }

  @Get('users/:username')
  @Public()
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'View a public profile (private accounts show a teaser to strangers).' })
  @ApiOkResponse({ type: ProfileResponseDto })
  getByUsername(
    @Param('username') username: string,
    @Req() req: Request,
  ): Promise<ProfileResponseDto> {
    const viewer = (req as Request & { user?: AuthenticatedUser }).user;
    return this.profileService.getPublicProfile(username, viewer?.id ?? null);
  }
}

function toUploaded(file: Express.Multer.File): { buffer: Buffer; mimetype: string; size: number } {
  return { buffer: file.buffer, mimetype: file.mimetype, size: file.size };
}
