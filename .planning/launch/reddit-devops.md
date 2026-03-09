Stop sharing credentials over Slack DM — one-time encrypted links with a burn timer

Sharing credentials with your team:

- Slack DM: message persists forever in search
- Email: stored in at least two inboxes
- 1Password vault: requires shared vault + admin access

There's a better option for ephemeral credentials. Torch Secret generates a one-time link — the server stores only encrypted ciphertext, and the decryption key lives in the URL fragment (per RFC 3986 §3.5, the browser strips it before the HTTP request, so the server literally cannot read it even under subpoena).

The link self-destructs 30 seconds after the recipient opens it — useful when you're sharing credentials that only need to survive a deploy window.

One-time destroy is the default: even without the timer, the link dies on first view. Add password protection if you need a second factor before the secret is revealed.

ISC license. Self-host with `docker-compose up` if you prefer not to use the hosted version.

Source: https://github.com/norcalcoop/torch-secret
Live: https://torchsecret.com
