/**
 * Brand age-assurance Worker (Cloudflare + D1). Serves the contract in
 * src/ageAssurance/muAgeService.ts. See ../README.md.
 */
import {createApp} from './app.ts'
import {createCallerVerifier} from './auth.ts'
import {createD1Store} from './store.ts'

interface Env {
  DB: D1Database
  SERVICE_DID: string
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return createApp({
      serviceDid: env.SERVICE_DID,
      store: createD1Store(env.DB),
      verifyCaller: createCallerVerifier({serviceDid: env.SERVICE_DID}),
    })(request)
  },
}
