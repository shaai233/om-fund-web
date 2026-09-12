import { afterEach, describe, expect, it, vi } from 'vitest'
import onRequest from '../api/fund-api.js'

function jsonUpstream (data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

async function callApi (path) {
  return onRequest({ request: new Request(`https://omfund.example${path}`) })
}

describe('Vercel fund function', function () {
  afterEach(function () {
    vi.unstubAllGlobals()
  })

  it('normalizes fund search results', async function () {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonUpstream({
      Datas: [
        { CODE: '161725', NAME: '招商中证白酒指数A' },
        { CODE: 'bad', NAME: '无效数据' }
      ]
    })))

    const response = await callApi('/api/search?q=白酒')
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data).toEqual([{ code: '161725', name: '招商中证白酒指数A', kind: 'fund' }])
  })

  it('merges estimate and fund net-value responses', async function () {
    vi.stubGlobal('fetch', vi.fn(function (url) {
      const target = String(url)
      if (target.includes('finance.sina.com.cn')) {
        return Promise.resolve(jsonUpstream({
          result: {
            status: { code: 0 },
            data: {
              networth: [{ pre_nav2: '1.2345', growthrate2: '0.0123', pre_date: '2026-09-02', min_time: '10:00:00' }]
            }
          }
        }))
      }
      return Promise.resolve(jsonUpstream({
        Success: true,
        Datas: [{ SHORTNAME: '示例基金', PDATE: '2026-09-01', NAV: '1.2000', NAVCHGRT: '0.30' }]
      }))
    }))

    const response = await callApi('/api/quotes?codes=161725')
    const payload = await response.json()

    expect(payload.data[0]).toMatchObject({
      fundcode: '161725',
      name: '示例基金',
      gsz: '1.2345',
      gszzl: '1.23',
      kind: 'fund'
    })
  })

  it('falls back to Tencent when the primary index endpoint fails', async function () {
    vi.stubGlobal('fetch', vi.fn(function (url) {
      if (String(url).includes('push2.eastmoney.com')) {
        return Promise.reject(new Error('primary unavailable'))
      }
      return Promise.resolve(new Response('v_s_sh000300="1~沪深300~000300~4628.10~-12.30~-0.26~"'))
    }))

    const response = await callApi('/api/quotes?codes=000300')
    const payload = await response.json()

    expect(payload.data[0]).toMatchObject({
      fundcode: '000300',
      name: '沪深300',
      gsz: '4628.10',
      gszzl: '-0.26',
      kind: 'index'
    })
  })

  it('rejects unknown routes instead of becoming an open proxy', async function () {
    vi.stubGlobal('fetch', vi.fn())
    const response = await callApi('/api/proxy?url=https://example.com')
    expect(response.status).toBe(404)
    expect(fetch).not.toHaveBeenCalled()
  })
})
