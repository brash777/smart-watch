import packageJson from '../../../package.json' with { type: 'json' };

export interface HealthStatus {
  status: 'ok';
  appName: string;
  /** Seconds since the process started. */
  uptime: number;
  /** Version of the API package (apps/api/package.json). */
  version: string;
}

export function getHealthStatus(appName: string): HealthStatus {
  return {
    status: 'ok',
    appName,
    uptime: Math.floor(process.uptime()),
    version: packageJson.version,
  };
}
