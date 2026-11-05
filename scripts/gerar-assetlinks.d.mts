export interface AssetLink {
  relation: string[];
  target: { namespace: 'android_app'; package_name: string; sha256_cert_fingerprints: string[] };
}
export function buildAssetLinks(packageId: string, sha256: string[]): AssetLink[];
export function lerFingerprints(valor?: string): string[];
