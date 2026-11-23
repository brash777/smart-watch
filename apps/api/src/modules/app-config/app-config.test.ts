import { appConfigSchema } from '@snapia/shared';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createDatabaseTestContext, paletteColor } from '../../../test/factories';
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetTestDatabase,
} from '../../../test/test-database';

const prisma = getTestPrisma();
const responseSchema = z.object({ data: appConfigSchema });

beforeEach(resetTestDatabase);
afterAll(disconnectTestPrisma);

describe('GET /api/app-config', () => {
  it('answers anyone with the Space palette and the upload limits of the environment', async () => {
    const { app, config } = createDatabaseTestContext();

    const response = await request(app).get('/api/app-config');

    expect(response.status).toBe(200);
    const { data } = responseSchema.parse(response.body);
    expect(data.spaces.colorPalette[0]).toBe(paletteColor(0));
    expect(data.uploads).toEqual({
      maxFiles: config.upload.maxFiles,
      maxFileSizeBytes: config.upload.maxFileSizeBytes,
      allowedMimeTypes: config.upload.allowedMimeTypes,
      imageMaxSidePx: config.upload.imageMaxSidePx,
    });
  });

  it('follows the space_color_palette setting', async () => {
    const palette = [paletteColor(1), paletteColor(2)];
    await prisma.appSetting.update({
      where: { key: 'space_color_palette' },
      data: { value: palette },
    });
    const { app } = createDatabaseTestContext();

    const response = await request(app).get('/api/app-config').expect(200);

    expect(responseSchema.parse(response.body).data.spaces.colorPalette).toEqual(palette);
  });
});
