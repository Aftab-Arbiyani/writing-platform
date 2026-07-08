import { Injectable } from '@nestjs/common';
import { FollowStatus, MAX_SOCIAL_LINKS, SOCIAL_LINK_URL_MAX } from '@qalam/shared';

import { TransactionRunner } from '../../common/database/transaction-runner';
import {
  ValidationFailedException,
  type ValidationErrorDetail,
} from '../../common/exceptions/validation-failed.exception';
import { MediaService } from '../../media/media.service';
import type { ImageKind, UploadedImage } from '../../media/image.service';
import { TaxonomyService } from '../taxonomy/taxonomy.service';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import {
  MediaKeyResponseDto,
  ProfileCountsDto,
  ProfileResponseDto,
  ViewerRelationDto,
} from './dto/profile-response.dto';
import type { Profile } from './entities/profile.entity';
import { UserNotFoundException } from './exceptions/users.exceptions';
import { FollowRepository } from './follow.repository';
import { ProfileRepository } from './profile.repository';
import { UsersService } from './users.service';

/**
 * Public-facing writer profile: lazy get-or-create (auth registration doesn't
 * create profiles), owner/public views with the docs 13 §4.2 visibility rules,
 * updates (with taxonomy validation), and avatar/cover uploads.
 */
@Injectable()
export class ProfileService {
  constructor(
    private readonly profiles: ProfileRepository,
    private readonly follows: FollowRepository,
    private readonly users: UsersService,
    private readonly taxonomy: TaxonomyService,
    private readonly media: MediaService,
    private readonly transactions: TransactionRunner,
  ) {}

  /** Returns the user's profile, creating a default one (pen name = username) if absent. */
  async getOrCreateByUserId(userId: string): Promise<Profile> {
    const existing = await this.profiles.findByUserId(userId);
    if (existing !== null) {
      return existing;
    }
    const user = await this.users.findById(userId);
    if (user === null) {
      throw new UserNotFoundException();
    }
    return this.profiles.create({ userId, penName: user.username });
  }

  async getOwnProfile(userId: string): Promise<ProfileResponseDto> {
    const profile = await this.getOrCreateByUserId(userId);
    const user = await this.users.findById(userId);
    return this.buildFull(profile, user?.username ?? '', {
      isSelf: true,
      isFollowing: false,
      hasPendingRequest: false,
    });
  }

  /** Public profile view; applies the private-account teaser rule for strangers. */
  async getPublicProfile(
    username: string,
    viewerUserId: string | null,
  ): Promise<ProfileResponseDto> {
    const user = await this.users.findByUsername(username);
    if (user === null) {
      throw new UserNotFoundException();
    }
    const profile = await this.getOrCreateByUserId(user.id);
    const relation = await this.resolveRelation(viewerUserId, user.id);

    const canSeeFull = relation.isSelf || relation.isFollowing || !profile.isPrivate;
    return canSeeFull
      ? this.buildFull(profile, user.username, relation)
      : buildTeaser(profile, user.username, relation);
  }

  async updateOwnProfile(userId: string, dto: UpdateProfileDto): Promise<ProfileResponseDto> {
    const profile = await this.getOrCreateByUserId(userId);

    if (dto.socialLinks !== undefined) {
      this.assertSocialLinks(dto.socialLinks);
    }
    const languageId =
      dto.defaultLanguageCode !== undefined
        ? await this.taxonomy.resolveLanguageCode(dto.defaultLanguageCode)
        : undefined;
    const genreIds =
      dto.genres !== undefined ? await this.taxonomy.resolveGenreSlugs(dto.genres) : undefined;

    await this.transactions.run(async (manager) => {
      await this.profiles.update(
        userId,
        {
          ...(dto.penName !== undefined && { penName: dto.penName.trim() }),
          ...(dto.bio !== undefined && { bio: dto.bio.trim() }),
          ...(dto.websiteUrl !== undefined && { websiteUrl: dto.websiteUrl }),
          ...(dto.location !== undefined && { location: dto.location.trim() }),
          ...(dto.socialLinks !== undefined && { socialLinks: dto.socialLinks }),
          ...(dto.isPrivate !== undefined && { isPrivate: dto.isPrivate }),
          ...(languageId !== undefined && { defaultLanguageId: languageId }),
        },
        manager,
      );
      if (genreIds !== undefined) {
        await this.profiles.setGenres(profile.id, genreIds, manager);
      }
    });

    return this.getOwnProfile(userId);
  }

  updateAvatar(userId: string, file: UploadedImage): Promise<MediaKeyResponseDto> {
    return this.replaceImage(userId, 'avatar', file);
  }

  updateCover(userId: string, file: UploadedImage): Promise<MediaKeyResponseDto> {
    return this.replaceImage(userId, 'cover', file);
  }

  private async replaceImage(
    userId: string,
    kind: ImageKind,
    file: UploadedImage,
  ): Promise<MediaKeyResponseDto> {
    const profile = await this.getOrCreateByUserId(userId);
    const oldKey = kind === 'avatar' ? profile.avatarKey : profile.coverKey;
    const key = await this.media.uploadProfileImage(userId, kind, file);
    await this.profiles.update(userId, kind === 'avatar' ? { avatarKey: key } : { coverKey: key });
    await this.media.deleteQuietly(oldKey);
    return { key };
  }

  private async buildFull(
    profile: Profile,
    username: string,
    relation: ViewerRelationDto,
  ): Promise<ProfileResponseDto> {
    const genreIds = await this.profiles.getGenreIds(profile.id);
    const genres = await this.taxonomy.getGenresByIds(genreIds);
    return {
      username,
      penName: profile.penName,
      avatarKey: profile.avatarKey,
      isPrivate: profile.isPrivate,
      counts: buildCounts(profile),
      viewerRelation: relation,
      restricted: false,
      bio: profile.bio,
      coverKey: profile.coverKey,
      websiteUrl: profile.websiteUrl,
      location: profile.location,
      socialLinks: profile.socialLinks,
      defaultLanguageId: profile.defaultLanguageId,
      genres,
    };
  }

  private async resolveRelation(
    viewerUserId: string | null,
    ownerId: string,
  ): Promise<ViewerRelationDto> {
    if (viewerUserId === null) {
      return { isSelf: false, isFollowing: false, hasPendingRequest: false };
    }
    if (viewerUserId === ownerId) {
      return { isSelf: true, isFollowing: false, hasPendingRequest: false };
    }
    const edge = await this.follows.find(viewerUserId, ownerId);
    return {
      isSelf: false,
      isFollowing: edge?.status === FollowStatus.Accepted,
      hasPendingRequest: edge?.status === FollowStatus.Pending,
    };
  }

  private assertSocialLinks(links: Record<string, string>): void {
    const details: ValidationErrorDetail[] = [];
    const entries = Object.entries(links);
    if (entries.length > MAX_SOCIAL_LINKS) {
      details.push({
        field: 'socialLinks',
        rule: 'maxSize',
        message: `at most ${MAX_SOCIAL_LINKS} links`,
      });
    }
    for (const [platform, url] of entries) {
      if (typeof url !== 'string' || url.length > SOCIAL_LINK_URL_MAX || !isHttpUrl(url)) {
        details.push({
          field: `socialLinks.${platform}`,
          rule: 'isUrl',
          message: 'must be a valid http(s) URL',
        });
      }
    }
    if (details.length > 0) {
      throw new ValidationFailedException(details);
    }
  }
}

function buildCounts(profile: Profile): ProfileCountsDto {
  // Engagement metrics are 0 until their source tables ship (pieces E4;
  // likes/claps/bookmarks/responses E7). Follow/following/pieces are the
  // denormalized profile columns — single row read, no N+1, no COUNT(*).
  return {
    followers: profile.followersCount,
    following: profile.followingCount,
    piecesPublished: profile.piecesCount,
    totalReads: 0,
    totalLikes: 0,
    totalClaps: 0,
    bookmarksReceived: 0,
    responseCount: 0,
  };
}

function buildTeaser(
  profile: Profile,
  username: string,
  relation: ViewerRelationDto,
): ProfileResponseDto {
  return {
    username,
    penName: profile.penName,
    avatarKey: profile.avatarKey,
    isPrivate: profile.isPrivate,
    counts: buildCounts(profile),
    viewerRelation: relation,
    restricted: true,
  };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
