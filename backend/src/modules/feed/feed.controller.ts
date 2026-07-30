import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { FeedItemDto } from './dto/feed-item.dto';
import { FeedQueryDto } from './dto/feed-query.dto';
import { FeedService } from './feed.service';

/**
 * The four feeds (docs 18 E6). `following` is authenticated (needs the viewer);
 * `latest` / `trending` / `discover` are `@Public()` (public browse). All return
 * the ADR §5 cursor envelope (`meta.pagination`). Thin controller (docs 16 §3.6).
 */
@ApiTags('feed')
@Controller('feed')
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  @Get('following')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pieces from writers you follow, newest first.' })
  @ApiOkResponse({ type: [FeedItemDto] })
  async following(@CurrentUser() user: AuthenticatedUser, @Query() query: FeedQueryDto) {
    const page = await this.feed.getFollowing(user.id, query);
    return { success: true as const, data: page.items, meta: { pagination: page.meta } };
  }

  @Get('latest')
  @Public()
  @ApiOperation({ summary: 'Newest published pieces; filterable + sortable.' })
  @ApiOkResponse({ type: [FeedItemDto] })
  async latest(@Query() query: FeedQueryDto) {
    const page = await this.feed.getLatest(query);
    return { success: true as const, data: page.items, meta: { pagination: page.meta } };
  }

  @Get('trending')
  @Public()
  @ApiOperation({ summary: 'Trending pieces (configurable score; Redis-cached snapshot).' })
  @ApiOkResponse({ type: [FeedItemDto] })
  async trending(@Query() query: FeedQueryDto) {
    const page = await this.feed.getLatest({ ...query, sort: 'trending' } as FeedQueryDto);
    return { success: true as const, data: page.items, meta: { pagination: page.meta } };
  }

  @Get('discover')
  @Public()
  @ApiOperation({ summary: 'Author-diverse public feed (one recent piece per author).' })
  @ApiOkResponse({ type: [FeedItemDto] })
  async discover(@Query() query: FeedQueryDto) {
    const page = await this.feed.getDiscover(query);
    return { success: true as const, data: page.items, meta: { pagination: page.meta } };
  }
}
