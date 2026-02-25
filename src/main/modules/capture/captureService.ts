import { Display, screen } from 'electron';
import screenshot from 'screenshot-desktop';
import sharp from 'sharp';
import { NormalizedRect } from '@main/utils/geometry';
import { logger } from '@main/utils/logger';

export class CaptureService {
  async captureRegion(display: Display, region: NormalizedRect): Promise<Buffer> {
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

    return sharp(selectedShot)
      .extract({
        left,
        top,
        width,
        height
      })
      .png()
      .toBuffer();
  }
}
