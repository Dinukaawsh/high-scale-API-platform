import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class VersioningService {
  private readonly defaultVersion: string;

  constructor(private readonly configService: ConfigService) {
    this.defaultVersion = this.configService.get<string>('API_VERSION', 'v1');
  }

  /**
   * Extract version from request header or URL
   */
  extractVersion(request: any): string {
    // Check header first (e.g., Accept: application/vnd.api+json;version=2)
    const acceptHeader = request.headers?.accept || '';
    const versionMatch = acceptHeader.match(/version[=:](\d+)/i);
    if (versionMatch) {
      return `v${versionMatch[1]}`;
    }

    // Check URL path (e.g., /v2/users)
    const urlMatch = request.url?.match(/^\/(v\d+)\//);
    if (urlMatch) {
      return urlMatch[1];
    }

    // Check custom header
    const versionHeader = request.headers?.['x-api-version'];
    if (versionHeader) {
      return versionHeader.startsWith('v')
        ? versionHeader
        : `v${versionHeader}`;
    }

    return this.defaultVersion;
  }

  /**
   * Check if version is supported
   */
  isVersionSupported(version: string, supportedVersions: string[]): boolean {
    return supportedVersions.includes(version);
  }

  /**
   * Get latest version
   */
  getLatestVersion(supportedVersions: string[]): string {
    return supportedVersions.sort().reverse()[0] || this.defaultVersion;
  }
}
