import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GIPHY,
  type GifSearchQueryInput,
  type GifDTO,
  type GifSearchResponseDTO,
} from '@yap/contracts';

const GIPHY_BASE = 'https://api.giphy.com/v1/gifs';

interface GiphyImage {
  url?: string;
  width?: string;
  height?: string;
  size?: string;
}
interface GiphyResult {
  id: string;
  title?: string;
  images?: Record<string, GiphyImage>;
}
interface GiphyPagination {
  offset?: number;
  count?: number;
  total_count?: number;
}
interface GiphyApiResponse {
  data?: GiphyResult[] | GiphyResult;
  pagination?: GiphyPagination;
}

export interface GifAttachmentSource {
  url: string;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
}

@Injectable()
export class GifsService {
  private readonly apiKey: string | undefined;
  private readonly proxySecret: string | undefined;
  private readonly publicApiUrl: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('GIPHY_API_KEY');
    this.proxySecret = config.get<string>('GIF_PROXY_SECRET');
    this.publicApiUrl = (config.get<string>('PUBLIC_API_URL') ?? 'http://localhost:3333').replace(
      /\/$/,
      '',
    );
  }

  async search(input: GifSearchQueryInput): Promise<GifSearchResponseDTO> {
    const key = this.requireApiKey();
    const q = input.q?.trim();
    const offset = Number.parseInt(input.pos ?? '', 10);
    const params = new URLSearchParams({
      api_key: key,
      limit: String(GIPHY.resultsPerPage),
      rating: GIPHY.rating,
    });
    if (q) params.set('q', q);
    if (Number.isFinite(offset) && offset > 0) params.set('offset', String(offset));
    // Search needs a query; the empty-query browse view uses trending.
    const data = await this.fetchGiphy(q ? 'search' : 'trending', params);
    const rows = Array.isArray(data.data) ? data.data : data.data ? [data.data] : [];
    const results = rows.map((r) => this.toGifDto(r)).filter((g): g is GifDTO => g !== null);
    return { results, next: this.nextOffset(data.pagination) };
  }

  async resolveForSend(gifId: string): Promise<GifAttachmentSource> {
    const key = this.requireApiKey();
    const params = new URLSearchParams({ api_key: key, rating: GIPHY.rating });
    const data = await this.fetchGiphy(encodeURIComponent(gifId), params);
    const result = Array.isArray(data.data) ? data.data[0] : data.data;
    const image = result?.images?.[GIPHY.fullFormat] ?? result?.images?.[GIPHY.previewFormat];
    if (!image?.url) throw new BadRequestException('GIF not found');
    return {
      url: this.proxyUrl(image.url),
      mimeType: 'image/gif',
      width: toInt(image.width) ?? 0,
      height: toInt(image.height) ?? 0,
      sizeBytes: toInt(image.size) ?? 0,
    };
  }

  async proxyFetch(token: string): Promise<{ contentType: string; body: Buffer }> {
    const url = this.verifyToken(token);
    const upstream = await fetch(url);
    if (!upstream.ok) throw new BadGatewayException('Failed to fetch GIF');
    return {
      contentType: upstream.headers.get('content-type') ?? 'image/gif',
      body: Buffer.from(await upstream.arrayBuffer()),
    };
  }

  private async fetchGiphy(path: string, params: URLSearchParams): Promise<GiphyApiResponse> {
    const res = await fetch(`${GIPHY_BASE}/${path}?${params.toString()}`);
    if (!res.ok) throw new BadGatewayException('Giphy request failed');
    return (await res.json()) as GiphyApiResponse;
  }

  private toGifDto(r: GiphyResult): GifDTO | null {
    const preview = r.images?.[GIPHY.previewFormat];
    if (!preview?.url) return null;
    return {
      id: r.id,
      description: r.title ?? '',
      previewUrl: this.proxyUrl(preview.url),
      width: toInt(preview.width),
      height: toInt(preview.height),
    };
  }

  private nextOffset(pagination: GiphyPagination | undefined): string | null {
    if (!pagination) return null;
    const offset = pagination.offset ?? 0;
    const count = pagination.count ?? 0;
    const total = pagination.total_count ?? 0;
    const nextOffset = offset + count;
    return nextOffset < total ? String(nextOffset) : null;
  }

  // Signs a Giphy media URL into a proxy URL our server can later verify and stream.
  private proxyUrl(mediaUrl: string): string {
    const secret = this.requireProxySecret();
    const payload = Buffer.from(mediaUrl).toString('base64url');
    const sig = createHmac('sha256', secret).update(payload).digest('hex');
    return `${this.publicApiUrl}/gifs/proxy?token=${payload}.${sig}`;
  }

  private verifyToken(token: string): string {
    const secret = this.requireProxySecret();
    const idx = token.lastIndexOf('.');
    if (idx <= 0) throw new BadRequestException('Invalid token');
    const payload = token.slice(0, idx);
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    const provided = Buffer.from(token.slice(idx + 1));
    const expectedBuf = Buffer.from(expected);
    if (provided.length !== expectedBuf.length || !timingSafeEqual(provided, expectedBuf)) {
      throw new BadRequestException('Invalid token');
    }
    const url = Buffer.from(payload, 'base64url').toString('utf8');
    const host = new URL(url).hostname;
    if (host !== 'giphy.com' && !host.endsWith('.giphy.com')) {
      throw new BadRequestException('Invalid host');
    }
    return url;
  }

  private requireApiKey(): string {
    if (!this.apiKey) throw new ServiceUnavailableException('GIF search is not configured');
    return this.apiKey;
  }

  private requireProxySecret(): string {
    if (!this.proxySecret) throw new ServiceUnavailableException('GIF proxy is not configured');
    return this.proxySecret;
  }
}

function toInt(value: string | undefined): number | null {
  if (value === undefined) return null;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}
