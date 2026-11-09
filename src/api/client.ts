import createClient from 'openapi-fetch'
import type { paths } from './schema'

// Typed client for the Echora API. The types in schema.d.ts are generated: run `bun run api:types` when the API changes.
// JSON-LD is required for collections to include `totalItems` and the pagination links in `view`.
export const api = createClient<paths>({
  baseUrl: import.meta.env.VITE_API_URL,
  headers: { Accept: 'application/ld+json' },
})
