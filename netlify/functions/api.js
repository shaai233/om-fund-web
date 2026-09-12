import onRequest from '../../api/fund-api.js'

export default async function handler (request, context) {
  const incomingUrl = new URL(request.url)
  const functionPrefix = '/.netlify/functions/api'

  // Netlify rewrites /api/* to this function. Normalize the rewritten path
  // back to the shared API path expected by fund-api.js.
  if (incomingUrl.pathname.startsWith(functionPrefix)) {
    const suffix = incomingUrl.pathname.slice(functionPrefix.length) || '/'
    incomingUrl.pathname = `/api${suffix}`
  }

  const normalizedRequest = new Request(incomingUrl, request)
  return onRequest({ request: normalizedRequest, context })
}
