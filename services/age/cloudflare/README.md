# age (Cloudflare)

Stores three yes/no answers per account - over 13, over 16, over 18 - so the app
can age-gate OAuth sessions, which cannot read the birthdate on the PDS. No
birthdate is ever sent or stored. This is self-declaration, not proof of age.

The client is `src/ageAssurance/muAgeService.ts`.

## How a request is trusted

The app asks the user's PDS for a short-lived service-auth token
(`com.atproto.server.getServiceAuth`) with this service as `aud` and the method
as `lxm`. The Worker resolves the account's DID document and checks the
signature, so it learns who is calling without ever seeing a password.

| Method | Endpoint                          | Result                              |
| ------ | --------------------------------- | ----------------------------------- |
| GET    | `/xrpc/social.mu.age.getStatus`   | `{declared, over13?, over16?, ...}` |
| POST   | `/xrpc/social.mu.age.setStatus`   | `{}`; body is the three flags       |
| GET    | `/.well-known/did.json`           | `did:web` identity                  |
| GET    | `/xrpc/_health`                   | uptime check                        |

## Deploy

The domain's DNS must be on the same Cloudflare account.

```bash
cd services/age/cloudflare
pnpm install
pnpm exec wrangler login
# first time only; put the printed id into wrangler.jsonc
pnpm exec wrangler d1 create tatrasky-age --location eeur
pnpm migrate
pnpm run deploy
curl https://age.tatrasky.sk/.well-known/did.json
```

Only after that, point `ageAssurance` in `src/config/brand.json` at it and
rebuild the app. A build-time `EXPO_PUBLIC_AGE_SERVICE_URL` or
`EXPO_PUBLIC_AGE_SERVICE_DID` overrides that file.

## Develop

```bash
pnpm test
pnpm typecheck
```

## Data

Rows are not removed automatically when an account is deleted. To remove one:

```bash
pnpm exec wrangler d1 execute tatrasky-age --remote \
  --command "DELETE FROM age_status WHERE did = '<did>'"
```
