const MOBILE_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'
const CODE_PATTERN = /^\d{6}$/
const MAX_CODES = 24

const INDEX_MAP = new Map([
  ['000001', { secid: '1.000001', name: '上证指数' }],
  ['399001', { secid: '0.399001', name: '深证成指' }],
  ['399006', { secid: '0.399006', name: '创业板指' }],
  ['000016', { secid: '1.000016', name: '上证50' }],
  ['000300', { secid: '1.000300', name: '沪深300' }],
  ['399005', { secid: '0.399005', name: '中小板指' }]
])

export default async function onRequest (context) {
  const request = context.request
  if (request.method !== 'GET') return jsonError('仅支持 GET 请求', 405)

  const url = new URL(request.url)
  try {
    if (url.pathname === '/api/search') return await handleSearch(url)
    if (url.pathname === '/api/quotes') return await handleQuotes(url)
    if (url.pathname === '/api/index-trends') return await handleIndexTrends(url)
    if (url.pathname === '/api/index-kline') return await handleIndexKline(url)
    if (url.pathname === '/api/fund-detail') return await handleFundDetail(url)
    return jsonError('接口不存在', 404)
  } catch (error) {
    console.error('[om-fund-api]', url.pathname, error)
    return jsonError('上游行情服务暂时不可用', 502)
  }
}

async function handleSearch (url) {
  const query = (url.searchParams.get('q') || '').trim().slice(0, 40)
  if (!query) return jsonResponse([])

  const target = new URL('https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx')
  target.searchParams.set('m', '1')
  target.searchParams.set('key', query)
  const payload = await fetchJson(target.toString(), { referer: 'https://fund.eastmoney.com/' })
  const results = Array.isArray(payload.Datas) ? payload.Datas : []
  const seen = new Set()
  const normalized = results.flatMap(function (item) {
    const code = String(item.CODE || '')
    const name = String(item.NAME || '')
    if (!CODE_PATTERN.test(code) || !name || seen.has(code)) return []
    seen.add(code)
    return [{ code, name, kind: 'fund' }]
  }).slice(0, 30)

  return jsonResponse(normalized, 200, 300)
}

async function handleQuotes (url) {
  const codes = Array.from(new Set((url.searchParams.get('codes') || '')
    .split(',')
    .map(function (code) { return code.trim() })
    .filter(function (code) { return CODE_PATTERN.test(code) })))
    .slice(0, MAX_CODES)

  if (!codes.length) return jsonResponse([])

  const settled = await Promise.allSettled(codes.map(function (code) {
    return INDEX_MAP.has(code) ? fetchIndexQuote(code) : fetchFundQuote(code)
  }))
  const quotes = settled.flatMap(function (result) {
    return result.status === 'fulfilled' && result.value ? [result.value] : []
  })
  return jsonResponse(quotes, 200, 10)
}

async function fetchFundQuote (code) {
  const [estimateResult, infoResult] = await Promise.allSettled([
    fetchSinaEstimate(code),
    fetchEastmoneyFundInfo(code)
  ])
  const estimate = estimateResult.status === 'fulfilled' ? estimateResult.value : null
  const info = infoResult.status === 'fulfilled' ? infoResult.value : null
  if (!estimate && !info) return null

  if (info && estimate && info.netValueDate >= estimate.date) {
    return {
      fundcode: code,
      name: info.name,
      jzrq: info.netValueDate,
      dwjz: fixed(info.netValue, 4),
      gsz: fixed(info.netValue, 4),
      gszzl: fixed(info.changePercent, 2),
      gztime: info.netValueDate,
      kind: 'fund'
    }
  }

  if (estimate) {
    const inferredNetValue = estimate.estimatedNetValue / (1 + estimate.changeRate)
    return {
      fundcode: code,
      name: info?.name || code,
      jzrq: info?.netValueDate || '',
      dwjz: fixed(info?.netValue ?? inferredNetValue, 4),
      gsz: fixed(estimate.estimatedNetValue, 4),
      gszzl: fixed(estimate.changeRate * 100, 2),
      gztime: `${estimate.date} ${estimate.time}`,
      kind: 'fund'
    }
  }

  return {
    fundcode: code,
    name: info.name,
    jzrq: info.netValueDate,
    dwjz: fixed(info.netValue, 4),
    gsz: fixed(info.netValue, 4),
    gszzl: fixed(info.changePercent, 2),
    gztime: info.netValueDate,
    kind: 'fund'
  }
}

async function fetchSinaEstimate (code) {
  const endpoint = `https://stock.finance.sina.com.cn/fundInfo/api/openapi.php/FdFundService.getEstimateNetworthPic?symbol=${code}`
  const payload = await fetchJson(endpoint, { referer: 'https://finance.sina.com.cn/' })
  const networth = payload?.result?.data?.networth
  const latest = Array.isArray(networth) ? networth[networth.length - 1] : null
  if (payload?.result?.status?.code !== 0 || !latest) return null
  const estimatedNetValue = numberValue(latest.pre_nav2)
  const changeRate = numberValue(latest.growthrate2)
  if (estimatedNetValue === null || changeRate === null) return null
  return {
    estimatedNetValue,
    changeRate,
    date: String(latest.pre_date || ''),
    time: String(latest.min_time || '')
  }
}

async function fetchEastmoneyFundInfo (code) {
  const endpoint = new URL('https://fundmobapi.eastmoney.com/FundMNewApi/FundMNFInfo')
  const params = {
    pageIndex: '1',
    pageSize: '1',
    plat: 'Android',
    appType: 'ttjj',
    product: 'EFund',
    Version: '1',
    deviceid: crypto.randomUUID(),
    Fcodes: code
  }
  Object.entries(params).forEach(function ([key, value]) { endpoint.searchParams.set(key, value) })
  const payload = await fetchJson(endpoint.toString(), { referer: 'https://fund.eastmoney.com/' })
  const item = Array.isArray(payload.Datas) ? payload.Datas[0] : null
  if (!payload.Success || !item) return null
  const netValue = numberValue(item.NAV)
  if (netValue === null) return null
  return {
    name: String(item.SHORTNAME || code),
    netValueDate: String(item.PDATE || ''),
    netValue,
    changePercent: numberValue(item.NAVCHGRT) ?? 0
  }
}

async function fetchIndexQuote (code) {
  const metadata = INDEX_MAP.get(code)
  const endpoint = `https://push2.eastmoney.com/api/qt/stock/get?secid=${metadata.secid}&fields=f58,f43,f44,f45,f46,f47,f48,f60,f169,f170,f171`
  try {
    const payload = await fetchJson(endpoint, { referer: 'https://quote.eastmoney.com/' })
    const node = payload?.data
    const rawPrice = numberValue(node?.f43)
    if (rawPrice === null) throw new Error('Invalid index response')
    return indexQuote(code, node.f58 || metadata.name, rawPrice / 100, (numberValue(node.f170) ?? 0) / 100, node)
  } catch {
    try {
      return await fetchTencentIndexQuote(code, metadata)
    } catch {
      const fallback = await fetchJson(`https://api.doctorxiong.club/v1/stock?code=${code}`)
      const item = Array.isArray(fallback.data) ? fallback.data[0] : null
      if (fallback.code !== 200 || !item) return null
      return indexQuote(code, item.name || metadata.name, numberValue(item.price) ?? 0, numberValue(item.changePercent) ?? 0)
    }
  }
}

async function fetchTencentIndexQuote (code, metadata) {
  const market = metadata.secid.startsWith('1.') ? 'sh' : 'sz'
  const response = await fetch(`https://qt.gtimg.cn/q=s_${market}${code}`, {
    headers: upstreamHeaders('https://gu.qq.com/')
  })
  if (!response.ok) throw new Error(`Tencent index upstream ${response.status}`)
  const source = await response.text()
  const match = source.match(/="([^"]+)"/)
  const fields = match?.[1]?.split('~') ?? []
  const price = numberValue(fields[3])
  const changePercent = numberValue(fields[5])
  if (price === null || changePercent === null) throw new Error('Invalid Tencent index response')
  return indexQuote(code, metadata.name, price, changePercent)
}

function indexQuote (code, name, price, changePercent, node = {}) {
  return {
    fundcode: code,
    name,
    jzrq: '',
    dwjz: fixed(price, 2),
    gsz: fixed(price, 2),
    gszzl: fixed(changePercent, 2),
    gztime: new Date().toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }),
    kind: 'index',
    high: scaleIndex(node.f44),
    low: scaleIndex(node.f45),
    open: scaleIndex(node.f46),
    preClose: scaleIndex(node.f60),
    change: scaleIndex(node.f169),
    volume: numberValue(node.f47),
    amount: numberValue(node.f48),
    amplitude: scaleIndex(node.f171)
  }
}

function scaleIndex (value) {
  const parsed = numberValue(value)
  return parsed === null ? '' : (parsed / 100).toFixed(2)
}

async function handleIndexTrends (url) {
  const code = (url.searchParams.get('code') || '').trim()
  const metadata = INDEX_MAP.get(code)
  if (!metadata) return jsonError('指数代码不支持', 400)
  const endpoint = new URL('https://push2.eastmoney.com/api/qt/stock/trends2/get')
  endpoint.searchParams.set('secid', metadata.secid)
  endpoint.searchParams.set('ndays', url.searchParams.get('days') === '5' ? '5' : '1')
  endpoint.searchParams.set('iscr', '0')
  endpoint.searchParams.set('fields1', 'f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13')
  endpoint.searchParams.set('fields2', 'f51,f52,f53,f54,f55,f56,f57,f58')
  const payload = await fetchJson(endpoint.toString(), { referer: 'https://quote.eastmoney.com/' })
  const trends = Array.isArray(payload?.data?.trends) ? payload.data.trends : []
  return jsonResponse(trends.flatMap(function (line) {
    const parts = String(line).split(',')
    if (parts.length < 2) return []
    const price = numberValue(parts[1])
    if (price === null) return []
    return [{ time: parts[0], price, average: numberValue(parts[2]) ?? price }]
  }), 200, 10)
}

async function handleIndexKline (url) {
  const code = (url.searchParams.get('code') || '').trim()
  const metadata = INDEX_MAP.get(code)
  const period = url.searchParams.get('period') || '101'
  if (!metadata) return jsonError('指数代码不支持', 400)
  if (period === '5d') return handleIndexTrends(new URL(`${url.origin}/api/index-trends?code=${code}&days=5`))
  const endpoint = new URL('https://push2his.eastmoney.com/api/qt/stock/kline/get')
  endpoint.searchParams.set('secid', metadata.secid)
  endpoint.searchParams.set('klt', period)
  endpoint.searchParams.set('fqt', '1')
  endpoint.searchParams.set('beg', '0')
  endpoint.searchParams.set('end', '20500101')
  endpoint.searchParams.set('lmt', '240')
  endpoint.searchParams.set('fields1', 'f1,f2,f3,f4,f5,f6')
  endpoint.searchParams.set('fields2', 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61')
  const payload = await fetchJson(endpoint.toString(), { referer: 'https://quote.eastmoney.com/' })
  const klines = Array.isArray(payload?.data?.klines) ? payload.data.klines : []
  return jsonResponse(klines.flatMap(function (line) {
    const parts = String(line).split(',')
    if (parts.length < 5) return []
    const open = numberValue(parts[1]); const close = numberValue(parts[2]); const high = numberValue(parts[3]); const low = numberValue(parts[4])
    if ([open, close, high, low].some(function (value) { return value === null })) return []
    return [{ time: parts[0], open, close, high, low }]
  }).slice(-120), 200, 60)
}

async function handleFundDetail (url) {
  const code = (url.searchParams.get('code') || '').trim()
  if (!CODE_PATTERN.test(code)) return jsonError('基金代码格式不正确', 400)
  const response = await fetch(`https://fund.eastmoney.com/pingzhongdata/${code}.js`, {
    headers: upstreamHeaders('https://fund.eastmoney.com/')
  })
  if (!response.ok) throw new Error(`Detail upstream ${response.status}`)
  const source = await response.text()
  const historyMatch = source.match(/var\s+Data_netWorthTrend\s*=\s*(\[[\s\S]*?\]);/)
  let history = []
  if (historyMatch) {
    try {
      history = JSON.parse(historyMatch[1]).flatMap(function (item) {
        const nav = numberValue(item.y)
        const timestamp = numberValue(item.x)
        if (nav === null || timestamp === null) return []
        return [{ date: new Date(timestamp).toISOString().slice(0, 10), nav }]
      })
    } catch {
      history = []
    }
  }

  return jsonResponse({
    name: extractVariable(source, 'fS_name') || code,
    code,
    returnOneYear: extractVariable(source, 'syl_1n') || '--',
    returnSixMonth: extractVariable(source, 'syl_6y') || '--',
    feeRate: extractVariable(source, 'fund_Rate') || '--',
    history
  }, 200, 3600)
}

function extractVariable (source, name) {
  const match = source.match(new RegExp(`var\\s+${name}\\s*=\\s*["']([^"']*)["']`))
  return match?.[1] || null
}

async function fetchJson (url, options = {}) {
  const response = await fetch(url, { headers: upstreamHeaders(options.referer) })
  if (!response.ok) throw new Error(`Upstream ${response.status}`)
  return response.json()
}

function upstreamHeaders (referer) {
  const headers = {
    Accept: 'application/json,text/plain,*/*',
    'User-Agent': MOBILE_USER_AGENT
  }
  if (referer) headers.Referer = referer
  return headers
}

function numberValue (value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function fixed (value, digits) {
  return Number(value).toFixed(digits)
}

function jsonResponse (data, status = 200, maxAge = 0) {
  return new Response(JSON.stringify({ data, fetchedAt: new Date().toISOString() }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': maxAge > 0 ? `public, max-age=${maxAge}` : 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  })
}

function jsonError (message, status) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  })
}
