import { vi } from 'vitest'

/** A fetch call as the code made it: method, URL, headers and body, whether it passed a Request or a URL. */
export interface Call {
  method: string
  url: string
  headers: Headers
  body: string
}

/** Every call the mocked fetch received so far. */
export async function calls(): Promise<Call[]> {
  return Promise.all(
    vi.mocked(fetch).mock.calls.map(async ([input, init]) => {
      const request = input instanceof Request ? input.clone() : new Request(String(input), init)
      return { method: request.method, url: request.url, headers: request.headers, body: await request.text() }
    }),
  )
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/** Answers each request with the first handler whose method and path match; anything else fails the test. */
export function routes(handlers: Record<string, (request: Request) => Response | Promise<Response>>): void {
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const request = input instanceof Request ? input : new Request(String(input), init)
    const key = `${request.method} ${new URL(request.url).pathname}`
    const handler = handlers[key]
    if (!handler) {
      throw new Error(`Unexpected request: ${key}`)
    }
    return handler(request)
  })
}

/** A JWT that expires `seconds` from now. Only the payload matters to the client, which never checks signatures. */
export function jwt(seconds: number, subject = 'listener'): string {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds, username: subject }))
  return `header.${payload.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')}.signature`
}
