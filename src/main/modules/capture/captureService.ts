import { Display, screen } from 'electron';
import screenshot from 'screenshot-desktop';
import sharp from 'sharp';
import { NormalizedRect } from '@main/utils/geometry';
import { logger } from '@main/utils/logger';

export interface CaptureOptions {
  imageCompressionEnabled: boolean;
  maxLongEdgePx?: number;
}

export interface CaptureResult {
  buffer: Buffer;
  mimeType: 'image/png';
  width: number;
  height: number;
  compressed: boolean;
}

const DEFAULT_MAX_LONG_EDGE_PX = 1400;

export class CaptureService {
  async captureRegion(display: Display, region: NormalizedRect, options: CaptureOptions): Promise<CaptureResult> {
    const displays = screen
      .getAllDisplays()
      .slice()
      .sort((a, b) => (a.bounds.x === b.bounds.x ? a.bounds.y - b.bounds.y : a.bounds.x - b.bounds.x));

    const displayIndex = Math.max(
      displays.findIndex((candidate) => candidate.id === display.id),
      0
    );

    const allShots = (await (screenshot as unknown as { all: (options?: unknown) => Promise<Buffer[]> }).all({
      format: 'png'
    })) as Buffer[];

    const selectedShot = allShots[displayIndex] ?? allShots[0];
    if (!selectedShot) {
      throw new Error('No display screenshot available.');
    }

    const metadata = await sharp(selectedShot).metadata();
    const sourceWidth = metadata.width ?? display.bounds.width;
    const sourceHeight = metadata.height ?? display.bounds.height;

    const scaleX = sourceWidth / display.bounds.width;
    const scaleY = sourceHeight / display.bounds.height;

    const left = Math.max(0, Math.floor((region.x - display.bounds.x) * scaleX));
    const top = Math.max(0, Math.floor((region.y - display.bounds.y) * scaleY));
    const width = Math.max(1, Math.floor(region.width * scaleX));
    const height = Math.max(1, Math.floor(region.height * scaleY));

    logger.info('Capturing region', {
      displayId: display.id,
      left,
      top,
      width,
      height
    });

    const extracted = sharp(selectedShot).extract({
      left,
      top,
      width,
      height
    });

    const extractedMeta = await extracted.metadata();
    const originalWidth = extractedMeta.width ?? width;
    const originalHeight = extractedMeta.height ?? height;

    let pipeline = extracted;
    let compressed = false;

    if (options.imageCompressionEnabled) {
      const maxLongEdgePx = options.maxLongEdgePx ?? DEFAULT_MAX_LONG_EDGE_PX;
      const longEdge = Math.max(originalWidth, originalHeight);

      if (longEdge > maxLongEdgePx) {
        compressed = true;
        pipeline = pipeline.resize({
          width: originalWidth >= originalHeight ? maxLongEdgePx : undefined,
          height: originalHeight > originalWidth ? maxLongEdgePx : undefined,
          fit: 'inside',
          withoutEnlargement: true
        });
      }
    }

    const buffer = await pipeline
      // Palette PNG significantly reduces upload size while preserving text readability.
      .png({ compressionLevel: 9, palette: true })
      .toBuffer();

    const finalMeta = await sharp(buffer).metadata();
    const finalWidth = finalMeta.width ?? originalWidth;
    const finalHeight = finalMeta.height ?? originalHeight;

    logger.info('Capture prepared for inference', {
      compressed,
      originalWidth,
      originalHeight,
      finalWidth,
      finalHeight
    });

    return {
      buffer,
      mimeType: 'image/png',
      width: finalWidth,
      height: finalHeight,
      compressed
    };
  }
}
