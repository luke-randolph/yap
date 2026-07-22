import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import {
  gifSearchQuerySchema,
  type GifSearchQueryInput,
  type GifSearchResponseDTO,
} from '@yap/contracts';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { GifsService } from './gifs.service';

@Controller('gifs')
export class GifsController {
  constructor(private readonly gifs: GifsService) {}

  @Get('search')
  @UseGuards(JwtAuthGuard)
  async search(
    @Query(new ZodValidationPipe(gifSearchQuerySchema)) query: GifSearchQueryInput,
  ): Promise<GifSearchResponseDTO> {
    return this.gifs.search(query);
  }

  // Public: <img> requests carry no bearer token. The signed token authorizes the fetch.
  @Get('proxy')
  @SkipThrottle()
  async proxy(@Query('token') token: string | undefined, @Res() res: Response): Promise<void> {
    const { contentType, body } = await this.gifs.proxyFetch(token ?? '');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(body);
  }
}
