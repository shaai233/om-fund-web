import onRequest from './fund-api.js'

/**
 * Vercel Web Handler adapter.
 *
 * The API implementation speaks the standard Request/Response APIs. Vercel
 * invokes this catch-all function for
 * every route under /api/*, so the original pathname and query string are
 * preserved unchanged.
 */
export default {
  async fetch (request) {
    return onRequest({ request })
  }
}
