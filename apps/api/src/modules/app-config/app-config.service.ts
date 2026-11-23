import type { AppConfig } from '@snapia/shared';
import type { Config } from '../../config/env';
import type { SettingsService } from '../settings/settings.service';

export interface AppConfigServiceDependencies {
  config: Config;
  settings: SettingsService;
}

/** The settings the web app needs: the Space palette, the Compose limits and the uploads. */
export function createAppConfigService({ config, settings }: AppConfigServiceDependencies) {
  return {
    async get(): Promise<AppConfig> {
      const { maxFiles, maxFileSizeBytes, allowedMimeTypes, imageMaxSidePx } = config.upload;
      return {
        spaces: { colorPalette: await settings.getSetting('space_color_palette') },
        compose: {
          maxSnaps: await settings.getSetting('max_snaps_per_compose'),
          assignmentGuideNotice: await settings.getSetting('assignment_guide_notice'),
        },
        uploads: {
          maxFiles,
          maxFileSizeBytes,
          allowedMimeTypes: [...allowedMimeTypes],
          imageMaxSidePx,
        },
      };
    },
  };
}

export type AppConfigService = ReturnType<typeof createAppConfigService>;
