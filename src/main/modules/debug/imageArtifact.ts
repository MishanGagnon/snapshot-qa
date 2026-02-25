import { app } from 'electron';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export async function writeLatestImageArtifact(fileName: string, buffer: Buffer): Promise<string> {
  const outputPath = resolveDebugImagePath(fileName);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buffer);
  return outputPath;
}

function resolveDebugImagePath(fileName: string): string {
  try {
    return join(app.getPath('userData'), 'debug', fileName);
  } catch {
    return join(process.cwd(), '.debug', fileName);
  }
}
