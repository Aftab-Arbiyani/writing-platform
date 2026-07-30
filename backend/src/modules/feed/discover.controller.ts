import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CursorPaginationDto } from '../../common/dto/cursor-pagination.dto';
import { Public } from '../auth/decorators/public.decorator';
import { DiscoveryService } from './discovery.service';
import { PieceDiscoverQueryDto, WriterDiscoverQueryDto } from './dto/discover-query.dto';
import { FeedItemDto } from './dto/feed-item.dto';
import { TrendingGenreDto, TrendingLanguageDto, TrendingTagDto } from './dto/trend-item.dto';
import { WriterCardDto } from './dto/writer-card.dto';

/**
 * Discovery surfaces (docs 18 E6). All `@Public()` — discovery is public browse.
 * Featured/popular/new writers via `?kind=`; featured/recent/most-clapped/
 * most-discussed pieces via `?kind=`; trending tags/genres/languages are cached
 * top-N widgets. Cursor envelope throughout.
 */
@ApiTags('discover')
@Controller('discover')
export class DiscoverController {
  constructor(private readonly discovery: DiscoveryService) {}

  @Get('writers')
  @Public()
  @ApiOperation({ summary: 'Discover writers: featured | popular | new (?kind=).' })
  @ApiOkResponse({ type: [WriterCardDto] })
  async writers(@Query() query: WriterDiscoverQueryDto) {
    const page = await this.discovery.getWriters(query);
    return { success: true as const, data: page.items, meta: { pagination: page.meta } };
  }

  @Get('pieces')
  @Public()
  @ApiOperation({ summary: 'Discover pieces: featured | recent | most_clapped | most_discussed.' })
  @ApiOkResponse({ type: [FeedItemDto] })
  async pieces(@Query() query: PieceDiscoverQueryDto) {
    const page = await this.discovery.getPieces(query);
    return { success: true as const, data: page.items, meta: { pagination: page.meta } };
  }

  @Get('tags')
  @Public()
  @ApiOperation({ summary: 'Trending tags (cached; ranked by recent public usage).' })
  @ApiOkResponse({ type: [TrendingTagDto] })
  async tags(@Query() query: CursorPaginationDto) {
    const page = await this.discovery.getTrendingTags(query);
    return { success: true as const, data: page.items, meta: { pagination: page.meta } };
  }

  @Get('genres')
  @Public()
  @ApiOperation({ summary: 'Trending genres (cached; ranked by recent public pieces).' })
  @ApiOkResponse({ type: [TrendingGenreDto] })
  async genres(@Query() query: CursorPaginationDto) {
    const page = await this.discovery.getTrendingGenres(query);
    return { success: true as const, data: page.items, meta: { pagination: page.meta } };
  }

  @Get('languages')
  @Public()
  @ApiOperation({ summary: 'Trending languages (cached; ranked by recent public pieces).' })
  @ApiOkResponse({ type: [TrendingLanguageDto] })
  async languages(@Query() query: CursorPaginationDto) {
    const page = await this.discovery.getTrendingLanguages(query);
    return { success: true as const, data: page.items, meta: { pagination: page.meta } };
  }
}
