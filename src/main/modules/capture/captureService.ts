import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { Display } from 'electron';
import sharp from 'sharp';
import { NormalizedRect } from '@main/utils/geometry';
import { logger } from '@main/utils/logger';
import { writeLatestImageArtifact } from '@main/modules/debug/imageArtifact';

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

interface IntegralRegion {
  left: number;
  top: number;
  width: number;
  height: number;
}

const execFileAsync = promisify(execFile);
const DEFAULT_MAX_LONG_EDGE_PX = 1400;

export class CaptureService {
  async captureRegion(display: Display, region: NormalizedRect, options: CaptureOptions): Promise<CaptureResult> {
    const sourceRegion = toIntegralRegion(region);

    logger.info('Capturing region', {
      displayId: display.id,
      sourceRegion,
      captureBackend: 'screencapture'
    });

    const nativeBuffer = await captureRegionWithScreencapture(sourceRegion);
    const nativeMeta = await sharp(nativeBuffer).metadata();
    const originalWidth = nativeMeta.width ?? sourceRegion.width;
    const originalHeight = nativeMeta.height ?? sourceRegion.height;

    let pipeline = sharp(nativeBuffer);
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

    try {
      const captureImagePath = await writeLatestImageArtifact('latest-capture.png', buffer);
      logger.info('Wrote latest capture image artifact', {
        captureImagePath,
        finalWidth,
        finalHeight
      });
    } catch (error) {
      logger.warn('Failed to write latest capture image artifact', {
        reason: error instanceof Error ? error.message : 'unknown'
      });
    }

    return {
      buffer,
      mimeType: 'image/png',
      width: finalWidth,
      height: finalHeight,
      compressed
    };
  }
}

function toIntegralRegion(region: NormalizedRect): IntegralRegion {
  const left = Math.floor(region.x);
  const top = Math.floor(region.y);
  const right = Math.ceil(region.x + region.width);
  const bottom = Math.ceil(region.y + region.height);

  return {
    left,
    top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top)
  };
}

async function captureRegionWithScreencapture(region: IntegralRegion): Promise<Buffer> {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'background-agent-capture-'));
  const imagePath = path.join(tempDir, 'capture.png');

  try {
    await execFileAsync('screencapture', [
      '-x',
      '-t',
      'png',
      `-R${region.left},${region.top},${region.width},${region.height}`,
      imagePath
    ]);
    return await readFile(imagePath);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown';
    throw new Error(`screencapture failed: ${reason}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
