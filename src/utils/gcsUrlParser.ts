export interface GCSModeConfig {
  bucket: string
  prefix: string
  filename?: string
}

export class GCSUrlParser {
  static parseUrl(pathname: string): GCSModeConfig | null {
    // Parse URL for GCS mode: /lqa-boss/gcs/<bucket>/<prefix>/<filename>.lqaboss
    const gcsMatch = pathname.match(/\/lqa-boss\/gcs\/([^\/]+)\/([^\/]+)\/([^\/]+\.lqaboss)$/)
    
    if (gcsMatch) {
      const [, bucket, prefix, filename] = gcsMatch
      const decodedBucket = decodeURIComponent(bucket)
      const decodedPrefix = decodeURIComponent(prefix)
      const decodedFilename = decodeURIComponent(filename)
      
      console.log('GCS mode detected:', { bucket: decodedBucket, prefix: decodedPrefix, filename: decodedFilename })
      
      return {
        bucket: decodedBucket,
        prefix: decodedPrefix,
        filename: decodedFilename
      }
    }
    
    // Check for bucket/prefix only: /lqa-boss/gcs/<bucket>/<prefix>/
    const prefixMatch = pathname.match(/\/lqa-boss\/gcs\/([^\/]+)\/([^\/]+)\/?$/)
    if (prefixMatch) {
      const [, bucket, prefix] = prefixMatch
      const decodedBucket = decodeURIComponent(bucket)
      const decodedPrefix = decodeURIComponent(prefix)
      
      console.log('GCS browse mode detected:', { bucket: decodedBucket, prefix: decodedPrefix })
      
      return {
        bucket: decodedBucket,
        prefix: decodedPrefix
      }
    }
    
    return null
  }

  static buildFileUrl(bucket: string, prefix: string, filename: string): string {
    return `/lqa-boss/gcs/${encodeURIComponent(bucket)}/${encodeURIComponent(prefix)}/${encodeURIComponent(filename)}`
  }

  static buildBrowseUrl(bucket: string, prefix: string): string {
    return `/lqa-boss/gcs/${encodeURIComponent(bucket)}/${encodeURIComponent(prefix)}/`
  }

  static isGCSUrl(pathname: string): boolean {
    return pathname.includes('/lqa-boss/gcs/')
  }
}