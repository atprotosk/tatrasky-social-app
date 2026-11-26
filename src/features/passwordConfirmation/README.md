# Password confirmation

OAuth sessions cannot manage App Passwords or read and write the birthdate: the
PDS requires a session made with the account password. Rather than signing the
user out, these features ask for the password like any other sensitive action.

`createConfirmedSession` makes a second, temporary session that lives only in
memory next to the OAuth session, which is never touched. It is deleted on
release: after five idle minutes, on unmount, on leaving the screen and on
account switch.

Rules:

- The password goes only to the account's own PDS. No fallback host.
- Never persist or log the password, the tokens or raw errors from this flow.
- Pass the returned client to the one thing that needs it. Do not feed it into
  the shared query hooks, whose caches are persisted.
