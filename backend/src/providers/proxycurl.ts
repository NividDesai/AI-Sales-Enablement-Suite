import { logger } from '../utils/logger'

// Proxycurl removed: this is now a no-op stub to keep imports stable
export async function fetchLinkedInProfile(_profileUrl: string): Promise<any | null> {
  logger.info('proxycurl:disabled')
  return null
}
