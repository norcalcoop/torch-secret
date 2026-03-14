/**
 * VS competitor page data for SSR routes at /vs/:competitor.
 *
 * Content sourced from .claude/competitor-pages/vs-*.md files.
 * Each entry contains:
 *   - meta: SEO metadata (title, canonical, description, OG tags)
 *   - bodyHtml: full semantic HTML for the <main> body (H1, comparison table, sections, CTA)
 *   - faqItems: FAQ question/answer pairs for FAQPage JSON-LD in <head> (NOT rendered in body)
 *
 * Design: glassmorphism hero card, semantic section headings, responsive comparison tables,
 * CTA button matching SPA accent color. Dark mode is handled by CSS custom properties in layout.ts.
 */

interface VsPageData {
  meta: {
    title: string;
    canonical: string;
    metaDesc: string;
    ogTitle: string;
    ogDesc: string;
  };
  /** Full HTML for the <main> body. FAQ items are in JSON-LD only — not visible here. */
  bodyHtml: string;
  faqItems: Array<{ question: string; answer: string }>;
}

const CTA_BUTTON = `<a href="/create" class="ssr-cta">Create a secure link &rarr;</a>`;

const CARD_OPEN = `<div class="ssr-card">`;
const CARD_CLOSE = `</div>`;

const H1 = (text: string) => `<h1 class="ssr-h1">${text}</h1>`;
const H2 = (text: string) => `<h2 class="ssr-h2">${text}</h2>`;
const P = (text: string) => `<p class="ssr-p">${text}</p>`;
const STRONG = (text: string) => `<strong class="ssr-strong">${text}</strong>`;
const HR = `<hr class="ssr-hr" />`;
const UL_OPEN = `<ul class="ssr-ul">`;
const UL_CLOSE = `</ul>`;
const LI = (text: string) => `<li class="ssr-li">${text}</li>`;

export const VS_PAGES: Record<string, VsPageData> = {
  onetimesecret: {
    meta: {
      title: 'Torch Secret vs. OneTimeSecret — Zero-Knowledge vs. Server-Side',
      canonical: 'https://torchsecret.com/vs/onetimesecret',
      metaDesc:
        'OneTimeSecret encrypts your secrets on their server. Torch Secret encrypts in your browser — the key never reaches us. One difference that matters.',
      ogTitle: 'Torch Secret vs. OneTimeSecret',
      ogDesc:
        "The same one-time link format. A fundamentally different security model. Here's what that means.",
    },
    bodyHtml: `
${CARD_OPEN}
${H1('Torch Secret vs. OneTimeSecret')}
${P(`${STRONG('TL;DR:')} OneTimeSecret is the tool that popularized one-time secret sharing. It works. But it encrypts your secrets on its server — which means the server can read your secret. Torch Secret encrypts in your browser. The key never leaves your device.`)}
${CARD_CLOSE}

${H2('At-a-glance comparison')}
<div class="ssr-overflow">
<table>
  <thead>
    <tr>
      <th></th>
      <th>Torch Secret</th>
      <th>OneTimeSecret</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>Encryption location</td><td>Browser (client-side)</td><td>Server-side</td></tr>
    <tr><td>Zero-knowledge</td><td>Yes</td><td>No</td></tr>
    <tr><td>Server sees your plaintext</td><td>Never</td><td>Briefly, before encrypt</td></tr>
    <tr><td>Open source</td><td>Yes</td><td>Yes</td></tr>
    <tr><td>Recipient needs an account</td><td>No</td><td>No</td></tr>
    <tr><td>Password protection</td><td>Yes (Argon2id)</td><td>Yes (bcrypt)</td></tr>
    <tr><td>API</td><td>Yes</td><td>Yes</td></tr>
    <tr><td>Self-host</td><td>Yes</td><td>Yes</td></tr>
    <tr><td>View receipts</td><td>Yes (Pro)</td><td>No</td></tr>
    <tr><td>Custom domains</td><td>Planned</td><td>Yes ($35/month)</td></tr>
    <tr><td>Free tier</td><td>Yes (unlimited, anonymous)</td><td>Yes (rate-limited)</td></tr>
    <tr><td>Paid starts at</td><td>$7/month (Pro)</td><td>$35/month (Identity+)</td></tr>
  </tbody>
</table>
</div>

${HR}

${H2('The one difference that changes everything')}
${P('OneTimeSecret and Torch Secret look similar from the outside: paste a secret, get a link, share it, it disappears after one view.')}
${P('The difference is what happens in the middle.')}
${P(`${STRONG('OneTimeSecret:')} Your plaintext is transmitted to their server over HTTPS, then encrypted server-side. OneTimeSecret manages the encryption keys. They could, in theory, decrypt your secret. Their security depends entirely on their infrastructure and access controls — which you cannot verify from outside.`)}
${P(`${STRONG('Torch Secret:')} Your secret never leaves your browser in plaintext. AES-256-GCM runs in your browser using the Web Crypto API. The encryption key is generated in your browser and embedded only in the URL fragment (<code>#key</code>). Per HTTP spec (RFC 3986), URL fragments are never transmitted to servers — not by the browser, not by network proxies, not logged in server access logs. Our server receives only the encrypted ciphertext.`)}
${P("The result: even if Torch Secret's servers were fully compromised tomorrow, the attacker would have a database of encrypted blobs with no keys to decrypt them. We genuinely cannot read what you store.")}

${HR}

${H2('Encryption model')}
${P(`${STRONG('OneTimeSecret:')} Server-side encryption with server-managed keys. They encrypt after receiving your plaintext. When you use a passphrase, it is bcrypt-hashed to verify on retrieval, but the secret itself is still encrypted server-side with OTS-controlled keys. You are trusting their operations team, their server hardening, and anyone who has ever had infrastructure access.`)}
${P(`${STRONG('Torch Secret:')} Client-side AES-256-GCM. Your browser generates a 256-bit random key and a 96-bit IV for every single secret. The key exists only in the URL fragment. We store only the encrypted blob. There are no keys on our servers to steal.`)}
${P('Both are open source. Read either codebase and verify for yourself.')}

${HR}

${H2('Pricing')}
<div class="ssr-overflow">
<table>
  <thead>
    <tr>
      <th></th>
      <th>Torch Secret</th>
      <th>OneTimeSecret</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>Free</td><td>Unlimited anonymous secrets</td><td>Rate-limited</td></tr>
    <tr><td>Pro</td><td>$7/month — history, view receipts</td><td>—</td></tr>
    <tr><td>Identity/Branding</td><td>Planned</td><td>$35/month — custom domains only</td></tr>
    <tr><td>Self-host</td><td>Free (open source)</td><td>Free (open source)</td></tr>
  </tbody>
</table>
</div>
${P("OneTimeSecret's paid tier is essentially a custom domain and branding product. There are no team features, no audit logs, no view receipts at any price. Their paid tier makes sense if your company wants secrets to come from <code>secrets.yourcompany.com</code>.")}
${P("Torch Secret's paid tier unlocks usage features: a personal history of secrets you've sent, view receipts (know when a secret was opened), and an extended 30-day expiration.")}

${HR}

${H2('Open source and auditability')}
${P('Both products publish their source code. For OneTimeSecret, this means you can audit the application logic and confirm secrets are deleted after viewing. But the encryption model is still server-side — the audit confirms deletion, not decryption impossibility.')}
${P("For Torch Secret, the open source code proves the architectural claim: you can verify that the key is generated in the browser, embedded in the fragment, and never sent to the server. The zero-knowledge claim is not a marketing assertion — it's a logical consequence of the code.")}

${HR}

${H2('API')}
${P("Both offer REST APIs for integrating secret sharing into CI/CD pipelines, onboarding workflows, or automation tools. OneTimeSecret's API is mature and widely used. Torch Secret's API covers the same core operations: create a secret, retrieve metadata, verify password.")}

${HR}

${H2('Self-hosting')}
${P('Both can be self-hosted. OneTimeSecret requires a Ruby on Rails environment. Torch Secret ships with Docker Compose for local and production deployments.')}
${P('Self-hosting either tool gives your organization full control over data residency. Self-hosting Torch Secret adds something extra: the zero-knowledge property is preserved even if your self-hosted infrastructure is compromised, because encryption keys exist only in shared URLs.')}

${HR}

${H2('Who Torch Secret is right for')}
${UL_OPEN}
${LI('Security engineers and developers who need verifiable zero-knowledge — not "trust us, we encrypt it"')}
${LI('Teams sharing database passwords, SSH keys, API tokens, or anything highly sensitive')}
${LI('Anyone who audits security tools before using them (open source + architectural proof)')}
${LI('Organizations that want view receipts — knowing when a secret was opened')}
${LI('Teams who need to collaborate around secret sharing (shared dashboard)')}
${UL_CLOSE}

${H2('Who OneTimeSecret is right for')}
${UL_OPEN}
${LI('Organizations that want a branded, white-labeled URL (<code>secrets.yourcompany.com</code>)')}
${LI("Teams already integrated with the OneTimeSecret API who don't want to change tooling")}
${LI('Use cases where server-side encryption meets your compliance requirements')}
${LI('Non-technical users who need the most widely-recognized tool in the category')}
${UL_CLOSE}

${HR}

${H2('Moving from OneTimeSecret to Torch Secret')}
${P("There is nothing to migrate. Secrets stored on OneTimeSecret will remain there until they're viewed or expire on their own schedule. For all future secrets, you use Torch Secret's link instead.")}
${P('The recipient experience is identical: they click a link, click "Reveal Secret," and that\'s the end. No account, no install, no change in workflow for people you share with.')}
${P("For API users: Torch Secret's API follows the same create/retrieve pattern. The main difference is the shape of the encrypted payload — your integration will need to pass through a client-side encryption step rather than sending plaintext to the API.")}

${HR}

${H2('Try Torch Secret')}
${P('No account. No install. Paste your secret, get a link.')}
${P('Your secret is encrypted in your browser before it reaches us. We store only the ciphertext. When the link is opened once, the record is permanently deleted.')}
${CTA_BUTTON}
    `,
    faqItems: [
      {
        question: 'Is OneTimeSecret zero-knowledge?',
        answer:
          "No. OneTimeSecret encrypts secrets on their server, which means the server handles your plaintext before encrypting it. The company can technically read any secret before it's encrypted. This doesn't mean they do — but it means you're trusting them not to.",
      },
      {
        question: 'Is Torch Secret zero-knowledge?',
        answer:
          'Yes. Encryption happens in your browser before anything is sent to the server. The encryption key is embedded in the URL fragment, which is never transmitted to servers per HTTP spec. Our servers store only ciphertext. We cannot decrypt what we store.',
      },
      {
        question: 'Can I use both tools?',
        answer:
          'Yes. They serve the same surface-level use case. The difference is architectural. If zero-knowledge matters for your threat model, use Torch Secret. If you need custom domains and a branded experience today, OneTimeSecret has that.',
      },
      {
        question: 'Is Torch Secret open source?',
        answer:
          'Yes. You can read and audit the full codebase, including the client-side encryption module.',
      },
      {
        question: 'Does OneTimeSecret delete secrets after viewing?',
        answer:
          'Yes. Both services atomically delete secrets on first view. The difference is the encryption model, not the deletion guarantee.',
      },
    ],
  },

  pwpush: {
    meta: {
      title: 'Torch Secret vs. Password Pusher — Zero-Knowledge vs. Server-Side',
      canonical: 'https://torchsecret.com/vs/pwpush',
      metaDesc:
        'Password Pusher encrypts server-side and requires paying for hosted access. Torch Secret encrypts in your browser, free to use, no self-hosting required.',
      ogTitle: 'Torch Secret vs. Password Pusher',
      ogDesc:
        'Both are open source. Both use AES-256-GCM. One of them processes your plaintext on the server.',
    },
    bodyHtml: `
${CARD_OPEN}
${H1('Torch Secret vs. Password Pusher')}
${P(`${STRONG('TL;DR:')} Password Pusher is a capable, open source tool with strong self-hosting and audit log features. It uses AES-256-GCM — but server-side, which means their server handles your plaintext before it is encrypted. Torch Secret runs the same encryption algorithm entirely in your browser. The key never reaches us.`)}
${CARD_CLOSE}

${H2('At-a-glance comparison')}
<div class="ssr-overflow">
<table>
  <thead>
    <tr>
      <th></th>
      <th>Torch Secret</th>
      <th>Password Pusher</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>Encryption location</td><td>Browser (client-side)</td><td>Server-side</td></tr>
    <tr><td>Zero-knowledge</td><td>Yes</td><td>No</td></tr>
    <tr><td>Server sees your plaintext</td><td>Never</td><td>Yes, before encryption</td></tr>
    <tr><td>Open source</td><td>Yes</td><td>Yes</td></tr>
    <tr><td>Free hosted tier</td><td>Yes (unlimited)</td><td>No (self-host only)</td></tr>
    <tr><td>Recipient needs an account</td><td>No</td><td>No</td></tr>
    <tr><td>Password protection</td><td>Yes (Argon2id)</td><td>Yes (server-side)</td></tr>
    <tr><td>File sharing</td><td>No</td><td>Yes (paid)</td></tr>
    <tr><td>Audit logs</td><td>Planned</td><td>Yes (paid hosted)</td></tr>
    <tr><td>View count expiration</td><td>No (one view only)</td><td>Yes (expire after N views)</td></tr>
    <tr><td>API</td><td>Yes</td><td>Yes</td></tr>
    <tr><td>Self-host</td><td>Yes</td><td>Yes (Docker)</td></tr>
    <tr><td>Custom domains</td><td>Planned</td><td>Yes (Pro)</td></tr>
    <tr><td>Requests (collect secrets)</td><td>No</td><td>Yes (paid)</td></tr>
    <tr><td>Free tier</td><td>Yes (unlimited, anonymous)</td><td>Open source only</td></tr>
    <tr><td>Paid starts at</td><td>$7/month (Pro)</td><td>$19/month (Premium)</td></tr>
  </tbody>
</table>
</div>

${HR}

${H2('Same algorithm. Different location. Different trust model.')}
${P("Password Pusher and Torch Secret both use AES-256-GCM. On paper, that sounds equivalent. It isn't.")}
${P(`${STRONG('Password Pusher:')} Your plaintext is transmitted to their server over HTTPS, then encrypted using a server-managed key. The server derives a unique encryption key per secret — but that key is derived and managed on the server. The server can decrypt any secret it stores. You are trusting their server infrastructure, their key management, and their operational security.`)}
${P(`${STRONG('Torch Secret:')} AES-256-GCM runs in your browser before any data is transmitted. Your browser generates a random 256-bit key. That key is placed in the URL fragment (<code>#key</code>) and embedded in the share link — never sent to our server. Per HTTP spec (RFC 3986), URL fragments are never transmitted to servers. We receive only encrypted ciphertext, and we have no keys to decrypt it.`)}
${P("The distinction: Password Pusher's security depends on their servers not being compromised or their team not being malicious. Torch Secret's security is architectural — it's not a matter of trust; it's a matter of what information the server physically receives.")}

${HR}

${H2('Encryption and trust')}
${P(`${STRONG('Password Pusher')} derives a unique encryption key per push and encrypts each field individually. This is thoughtful server-side encryption. But the key is still derived on the server, and the server manages that key. In a breach scenario, an attacker with database access + key access can decrypt every stored secret.`)}
${P(`${STRONG('Torch Secret')} generates encryption keys only in the browser. Our server stores only ciphertext and IV. In a full breach of Torch Secret's database, an attacker recovers a collection of AES-256-GCM ciphertexts with no keys — mathematically useless without the URL fragment that the server never received.`)}

${HR}

${H2('Pricing and access model')}
${P('Password Pusher has no free hosted tier. To use it for free, you run your own server (Docker is available and well-documented, but it requires infrastructure). For hosted access:')}
${UL_OPEN}
${LI(`${STRONG('Premium (Individual):')} $19/month — adds file sharing, one-time upload requests, branding, audit logs`)}
${LI(`${STRONG('Pro (Teams):')} $29/month for 5 users, $3/user after — adds custom domains, 2FA management, team policies`)}
${UL_CLOSE}
${P('Torch Secret is free to use with no account required. The free tier has no arbitrary limits — create as many anonymous secrets as you need. Paid tiers unlock account features:')}
${UL_OPEN}
${LI(`${STRONG('Pro:')} $7/month — share history, view receipts, 30-day expiration`)}
${UL_CLOSE}

${HR}

${H2('Self-hosting')}
${P("Both support self-hosting. Password Pusher has a mature Docker image and extensive documentation — it's been around longer and has a larger self-hosting community.")}
${P("Torch Secret also ships Docker Compose for production deployment. Self-hosting Torch Secret carries an architectural advantage: because encryption is client-side, compromising your self-hosted server still doesn't expose the plaintext of stored secrets. Your server is a dumb encrypted blob store.")}

${HR}

${H2("Features Password Pusher has that Torch Secret doesn't (yet)")}
${P("Be direct here: Password Pusher has features Torch Secret doesn't have today.")}
${UL_OPEN}
${LI(`${STRONG('File sharing')} — you can push a file, not just text (paid)`)}
${LI(`${STRONG('Requests')} — send a secure link to someone so they can upload a secret to you (paid)`)}
${LI(`${STRONG('View count expiration')} — expire after N views, not just the first view`)}
${LI(`${STRONG('Audit logs')} — full view trail with timestamps (paid)`)}
${LI(`${STRONG('Custom domains')} — brand your instance (Pro)`)}
${UL_CLOSE}
${P("If your team needs file sharing, inbound secret collection, or compliance-grade audit logs with custom branding today, Password Pusher's Pro plan covers those. Come back to Torch Secret when those features land.")}

${HR}

${H2("Features Torch Secret has that Password Pusher doesn't")}
${UL_OPEN}
${LI(`${STRONG('True zero-knowledge')} — the server is architecturally incapable of reading your secrets`)}
${LI(`${STRONG('Free hosted tier')} — no credit card, no self-hosting required`)}
${LI(`${STRONG('View receipts')} — know when your specific secret was opened (Pro)`)}
${LI(`${STRONG('Simpler UX')} — Password Pusher's interface accumulates features; Torch Secret does one thing with a minimal interface`)}
${UL_CLOSE}

${HR}

${H2('Who Torch Secret is right for')}
${UL_OPEN}
${LI('Security teams who need verifiable zero-knowledge, not server-side-encrypted "trust us"')}
${LI('Developers who want a free, zero-friction hosted solution without running infrastructure')}
${LI('Teams sharing highly sensitive credentials where server trust is not acceptable')}
${LI('Anyone who wants view receipts — knowing when their specific secret was opened')}
${LI("Organizations who don't need file sharing or inbound collection today")}
${UL_CLOSE}

${H2('Who Password Pusher is right for')}
${UL_OPEN}
${LI('Organizations with existing infrastructure who prefer to self-host everything')}
${LI('Teams who need file sharing or the Requests (inbound collection) feature')}
${LI('Compliance teams who need built-in audit logs today')}
${LI('DevOps teams who want view count expiration (expire after exactly 3 views, for example)')}
${LI('Groups already integrated with the Password Pusher API')}
${UL_CLOSE}

${HR}

${H2('Moving from Password Pusher to Torch Secret')}
${P("Nothing to migrate. Existing secrets on Password Pusher will remain until they're viewed or expire. All new secrets go through Torch Secret's link.")}
${P('For API migrations: both tools follow a create-then-retrieve pattern. The primary difference is that Torch Secret requires client-side encryption before calling the API — the API accepts only encrypted ciphertext, never plaintext. This is intentional and by design.')}

${HR}

${H2('Try Torch Secret')}
${P('No account. No self-hosting required. Paste your secret, get a link, share once.')}
${CTA_BUTTON}
    `,
    faqItems: [
      {
        question: 'Does Password Pusher use zero-knowledge encryption?',
        answer:
          'No. Password Pusher uses AES-256-GCM server-side. The server derives and manages encryption keys. Your plaintext is transmitted to the server before encryption occurs. The server can decrypt any active secret.',
      },
      {
        question: 'Does Torch Secret use the same encryption algorithm as Password Pusher?',
        answer:
          'Both use AES-256-GCM, but in different locations. Password Pusher runs it server-side; Torch Secret runs it in your browser. The algorithm is the same; the trust model is entirely different.',
      },
      {
        question: 'Can I self-host both?',
        answer:
          "Yes. Both are open source with Docker support. Password Pusher has a larger self-hosting community and more documentation. Torch Secret's self-hosted instance has an architectural advantage: server compromise doesn't expose stored secrets because encryption keys never reach the server.",
      },
      {
        question: 'Is Password Pusher free?',
        answer:
          'The open source code is free — but you must self-host it. There is no free hosted tier on pwpush.com. Torch Secret has a free hosted tier with no account required.',
      },
      {
        question: 'Does Password Pusher have file sharing?',
        answer:
          'Yes, on the paid hosted plans (Premium and Pro). Torch Secret does not currently support file sharing.',
      },
    ],
  },

  'bitwarden-send': {
    meta: {
      title: 'Torch Secret vs. Bitwarden Send — When Each Is Right',
      canonical: 'https://torchsecret.com/vs/bitwarden-send',
      metaDesc:
        "Torch Secret and Bitwarden Send both share secrets securely — but they solve different problems. Here's when to use each.",
      ogTitle: 'Torch Secret vs. Bitwarden Send',
      ogDesc:
        'Zero-knowledge one-time secrets without a Bitwarden account. Compare features and use cases.',
    },
    bodyHtml: `
${CARD_OPEN}
${H1('Torch Secret vs. Bitwarden Send')}
${P(`${STRONG('TL;DR:')} Both tools protect sensitive data in transit. Bitwarden Send is built for teams already inside the Bitwarden ecosystem. Torch Secret is for anyone — no accounts, no apps, no setup on either end.`)}
${CARD_CLOSE}

${CARD_OPEN}
${H2('When Bitwarden Send is the right choice')}
${UL_OPEN}
${LI('Your whole team already uses Bitwarden for password management')}
${LI('You want to share inside a controlled workspace with audit logs')}
${LI('The recipient already has Bitwarden installed')}
${LI('You need to send the same secret to multiple recipients')}
${UL_CLOSE}
${CARD_CLOSE}

${CARD_OPEN}
${H2('When Torch Secret is the right choice')}
${UL_OPEN}
${LI('The recipient has no Bitwarden account — no setup required on their end')}
${LI('You need one-time destruction — the secret vanishes after the first view, guaranteed')}
${LI("You're sharing outside your organization (contractors, clients, anyone)")}
${LI('Zero-knowledge architecture matters — the server never sees plaintext or the key')}
${LI('You want a link that works in any browser, no app needed')}
${UL_CLOSE}
${CARD_CLOSE}

${CARD_OPEN}
${H2('Feature comparison')}
${P('Torch Secret vs. Bitwarden Send — key differences:')}
${UL_OPEN}
${LI(`${STRONG('Account required (recipient):')} Torch Secret — none. Bitwarden Send — none (link-based).`)}
${LI(`${STRONG('Account required (sender):')} Torch Secret — optional (free tier, no signup). Bitwarden Send — yes, Bitwarden account required.`)}
${LI(`${STRONG('Encryption key location:')} Torch Secret — URL fragment, never sent to server. Bitwarden Send — server-side key management.`)}
${LI(`${STRONG('One-time destruction:')} Torch Secret — atomic delete on first view. Bitwarden Send — configurable (1–1000 views).`)}
${LI(`${STRONG('Max expiration:')} Torch Secret Pro — 30 days. Bitwarden Send — 31 days.`)}
${LI(`${STRONG('Price for sender:')} Torch Secret — free (up to 7-day expiry). Bitwarden — free tier includes Send.`)}
${UL_CLOSE}
${CARD_CLOSE}

${CTA_BUTTON}
    `,
    faqItems: [
      {
        question: 'Why pay $65/year for Torch Secret when Bitwarden Send is free?',
        answer:
          "Bitwarden Send requires the sender to have a Bitwarden account. Torch Secret Free requires no account at all — just paste and share. The Pro plan ($5.42/mo) adds 30-day expiry, a secret dashboard, and email notification when your secret is viewed. If you're already paying for Bitwarden, Send is a great bundled option. If you need to share with anyone outside your Bitwarden workspace without any setup friction, Torch Secret is faster.",
      },
      {
        question: 'Is Torch Secret zero-knowledge in the same way Bitwarden is?',
        answer:
          'Different architectures. Bitwarden uses a zero-knowledge password vault where your vault key never leaves your device. Torch Secret uses a URL-fragment key: the AES-256 encryption key is generated in your browser, placed in the URL fragment (#key), and shared only via the link. The fragment is never sent to the server per HTTP spec (RFC 3986 §3.5). A full server breach reveals only encrypted blobs — no keys, no plaintext.',
      },
      {
        question: 'Can I use both Bitwarden Send and Torch Secret?',
        answer:
          'Absolutely. Many security-conscious teams use Bitwarden for internal password management and Torch Secret for external one-time shares with contractors, clients, or anyone without a Bitwarden account.',
      },
    ],
  },

  'email-and-slack': {
    meta: {
      title: "Stop Sharing Passwords Over Email and Slack — There's a Safer Way",
      canonical: 'https://torchsecret.com/vs/email-and-slack',
      metaDesc:
        'Passwords sent over email or Slack sit in message history forever. Torch Secret creates a one-time link that self-destructs after the recipient opens it.',
      ogTitle: 'Stop Sharing Passwords Over Email and Slack',
      ogDesc: 'One-time encrypted links that self-destruct. No accounts. No message history. Free.',
    },
    bodyHtml: `
${CARD_OPEN}
${H1('Stop Sharing Passwords Over Email and Slack')}
${P(`${STRONG('The problem:')} Pasting a password into Slack or email leaves it in message history — searchable, forwarded, and exposed in every breach of that platform. There's a better way.`)}
${CARD_CLOSE}

${CARD_OPEN}
${H2('Why email and Slack are risky for credentials')}
${UL_OPEN}
${LI('Message history is permanent — that Slack DM or email thread lives forever, even after the job is done')}
${LI('Breach exposure — if your Slack workspace or email is compromised, every password you ever shared is exposed')}
${LI('No self-destruction — you cannot unsend an email or guarantee a Slack message was deleted')}
${LI('Forwarding and screenshots — you cannot control what the recipient does with the message')}
${LI('Audit risk — regulators increasingly scrutinize credential-sharing practices in audit logs')}
${UL_CLOSE}
${CARD_CLOSE}

${CARD_OPEN}
${H2('How Torch Secret is different')}
${UL_OPEN}
${LI('Your secret is encrypted in the browser before it leaves your device — the server only stores ciphertext')}
${LI('The decryption key lives in the URL fragment (#key) — it is never sent to the server per HTTP spec')}
${LI('The secret is atomically destroyed on first view — a full server dump after the recipient opens it reveals nothing')}
${LI('No account required for the recipient — share a link, they click it, the secret is gone')}
${LI('Optional password protection and expiration for additional control')}
${UL_CLOSE}
${CARD_CLOSE}

${CARD_OPEN}
${H2('Common use cases')}
${UL_OPEN}
${LI('Sharing an API key or database password with a contractor')}
${LI('Sending a temporary admin password to a new employee')}
${LI('Passing credentials to a client without an account or app on either side')}
${LI('Securely sending a WiFi password, SSH key, or two-factor recovery code')}
${UL_CLOSE}
${CARD_CLOSE}

${CTA_BUTTON}
    `,
    faqItems: [
      {
        question: 'Is this really more secure than sending over a company Slack?',
        answer:
          "Yes — for credentials specifically. Slack is a collaboration platform, not a secrets manager. Your Slack workspace message history is stored on Slack's servers, accessible to workspace admins, and exposed if the workspace is compromised. Torch Secret encrypts in your browser, keeps the key out of server reach, and destroys the secret after one view.",
      },
      {
        question: 'What if I need to share the same password with multiple people?',
        answer:
          "Create a separate Torch Secret link for each recipient. Each link is one-time — after the first view, it's gone. This gives you per-recipient control and a clean audit trail.",
      },
      {
        question: 'Does the recipient need to create an account?',
        answer:
          "No. The recipient clicks the link and sees the secret immediately. No signup, no app, no friction. That's intentional — the security model should not depend on the recipient having any particular software.",
      },
      {
        question: 'What happens if I accidentally send the wrong person the link?',
        answer:
          'Open the link yourself before they do — viewing it destroys it. Or, if the link has not been viewed, it will automatically expire based on your chosen expiration time (1 hour to 30 days on Pro).',
      },
    ],
  },

  privnote: {
    meta: {
      title: 'Torch Secret vs. Privnote — Open Source vs. Closed, Verified vs. Trust-Us',
      canonical: 'https://torchsecret.com/vs/privnote',
      metaDesc:
        "Privnote's encryption cannot be audited — it's not open source. Torch Secret is open source, zero-knowledge, and ad-free. Here's the comparison.",
      ogTitle: 'Torch Secret vs. Privnote',
      ogDesc:
        "Privnote says it encrypts in your browser. You can't verify that. With Torch Secret, you can.",
    },
    bodyHtml: `
${CARD_OPEN}
${H1('Torch Secret vs. Privnote')}
${P(`${STRONG('TL;DR:')} Privnote is one of the oldest tools in this category and still widely used. It claims browser-side encryption. But because it is not open source, that claim is unverifiable. Torch Secret makes the same security guarantee — and backs it with auditable code.`)}
${CARD_CLOSE}

${H2('At-a-glance comparison')}
<div class="ssr-overflow">
<table>
  <thead>
    <tr>
      <th></th>
      <th>Torch Secret</th>
      <th>Privnote</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>Encryption location</td><td>Browser (verified)</td><td>Browser (claimed, unverified)</td></tr>
    <tr><td>Zero-knowledge</td><td>Yes (verifiable)</td><td>Claimed (unverifiable)</td></tr>
    <tr><td>Open source</td><td>Yes</td><td>No</td></tr>
    <tr><td>Auditable code</td><td>Yes</td><td>No</td></tr>
    <tr><td>Ad-free</td><td>Yes</td><td>No (ad-supported)</td></tr>
    <tr><td>Password protection</td><td>Yes (Argon2id, server-side)</td><td>No (reference phrase only)</td></tr>
    <tr><td>API</td><td>Yes</td><td>No</td></tr>
    <tr><td>Self-host</td><td>Yes</td><td>No</td></tr>
    <tr><td>View receipts</td><td>Yes (Pro)</td><td>Yes (email notification)</td></tr>
    <tr><td>Account required (recipient)</td><td>No</td><td>No</td></tr>
    <tr><td>Phishing clone risk</td><td>Low (open source, self-hostable)</td><td>High (documented problem)</td></tr>
    <tr><td>Free tier</td><td>Yes, unlimited, no ads</td><td>Yes, ad-supported</td></tr>
    <tr><td>Paid tier</td><td>$7/month (Pro)</td><td>None</td></tr>
  </tbody>
</table>
</div>

${HR}

${H2('"We encrypt in your browser." Prove it.')}
${P("Privnote claims its notes are AES-256 encrypted in the browser before reaching their servers. If true, that's a meaningful security guarantee.")}
${P("The problem: you cannot verify it. Privnote is closed source. No one outside the company can confirm that the code running in your browser does what they say it does. You're trusting a marketing claim with no audit path.")}
${P("This is not a theoretical concern. Security researchers have noted that Privnote clone sites — identical interfaces served from lookalike domains — exist specifically to intercept notes before they're encrypted, delivering decryptable data to the attacker instead. The absence of open source code makes it harder to distinguish authentic Privnote from a clone.")}
${P(`${STRONG('Torch Secret is open source.')} You can read the encryption module, verify that key generation happens in the browser using the Web Crypto API, confirm the key is embedded in the URL fragment and never transmitted, and reproduce the entire security model yourself. The zero-knowledge property is not a claim — it's a logical consequence of the code, readable by anyone.`)}

${HR}

${H2('Encryption and verifiability')}
${P(`${STRONG('Privnote:')} Claims AES-256 client-side encryption with the key in the URL fragment. If accurate, this is a good model. But the code is not public. You cannot audit it. You cannot verify that plaintext does not also pass through their server. You cannot confirm that the "delete on view" is atomic and complete. You are trusting their word.`)}
${P(`${STRONG('Torch Secret:')} AES-256-GCM runs in your browser via the Web Crypto API. The encryption key is generated in the browser (<code>crypto.getRandomValues</code>) and placed only in the URL fragment. The server receives only the encrypted blob plus IV. The code is on GitHub. Read it. Deploy it yourself. Every part of the security model is verifiable.`)}

${HR}

${H2('Password protection')}
${P(`${STRONG('Privnote:')} Offers a "reference phrase" — a label the sender sets that the recipient must know. This is a shared secret for identity confirmation, not cryptographic password protection on the note itself. It does not add an encryption layer.`)}
${P(`${STRONG('Torch Secret:')} Password protection adds a real second factor. The password is verified server-side using Argon2id (OWASP-recommended parameters). A note with password protection requires both the URL (containing the encryption key) and the password to be revealed. Two separate channels, two separate factors.`)}

${HR}

${H2('API and integrations')}
${P(`${STRONG('Privnote:')} No API. You can only create notes through the web interface.`)}
${P(`${STRONG('Torch Secret:')} REST API. Integrate secret sharing into onboarding flows, CI/CD pipelines, deployment scripts, or internal tooling.`)}

${HR}

${H2('Self-hosting')}
${P(`${STRONG('Privnote:')} Cannot be self-hosted. There is only one instance: privnote.com.`)}
${P(`${STRONG('Torch Secret:')} Fully self-hostable via Docker Compose. If you run your own instance, you eliminate all third-party trust: you control the server, and encryption still happens client-side, so even you cannot read stored secrets.`)}

${HR}

${H2('Ads')}
${P(`${STRONG('Privnote:')} Ad-supported. Ads appear on the interface for a tool you're using to handle sensitive credentials. This is not inherently a security risk, but it creates a trust friction: a tool monetized through third-party ad networks, handling your secrets, with no auditable code.`)}
${P(`${STRONG('Torch Secret:')} No ads. Free tier is funded by Pro subscriptions.`)}

${HR}

${H2('The phishing clone problem')}
${P('Privnote has a documented phishing problem. Sites like <code>privnot.com</code>, <code>privnotes.com</code>, and others serve identical interfaces designed to capture your note before encryption or to redirect you to a real page after harvesting the content.')}
${P("Because Privnote is closed source and hosted only on one domain, there's no easy way for users to verify they're on the legitimate site or distinguish the real site from a clone by examining behavior.")}
${P('Torch Secret is open source and self-hostable. If your organization is concerned about domain spoofing, you can run your own instance. The code is identical; the trust is internal.')}

${HR}

${H2('Who Torch Secret is right for')}
${UL_OPEN}
${LI('Anyone who wants verifiable security — open source code that proves the zero-knowledge claim')}
${LI('Developers who need an API for workflow integration')}
${LI('Teams sharing actual credentials (API keys, passwords, tokens) where unverifiable encryption is not acceptable')}
${LI('Organizations that need password protection as a real second factor')}
${LI("Users who don't want ads on a security tool")}
${UL_CLOSE}

${H2('Who Privnote is right for')}
${UL_OPEN}
${LI("Casual users sharing non-critical notes who don't need an audit trail")}
${LI("Non-technical users who want the simplest possible interface and aren't sharing high-stakes credentials")}
${LI('People who need nothing more than "this note disappears after one view" for low-sensitivity content')}
${UL_CLOSE}

${HR}

${H2('Moving from Privnote to Torch Secret')}
${P("No data to migrate. For all future secrets, use Torch Secret's link. The recipient experience is equivalent: click a link, the note appears, it's gone. No account required.")}
${P("If you've been using Privnote for casual notes and want to start using Torch Secret for actual credentials, the upgrade in security properties is meaningful even if the surface-level workflow is identical.")}

${HR}

${H2('Try Torch Secret')}
${P('Open source. Zero-knowledge. Ad-free. No account required.')}
${P("Paste your secret. We encrypt it in your browser before it reaches our server. Share the link once, and it's gone.")}
${CTA_BUTTON}
    `,
    faqItems: [
      {
        question: 'Is Privnote zero-knowledge?',
        answer:
          "Privnote claims browser-side encryption with the key in the URL fragment — which would be zero-knowledge if true. But the code is closed source and cannot be verified. You cannot confirm that plaintext doesn't also pass through their server.",
      },
      {
        question: 'Is Torch Secret open source?',
        answer:
          'Yes. The full codebase — including the client-side encryption module — is on GitHub. You can read it, audit it, and deploy it yourself.',
      },
      {
        question: 'Does Privnote have an API?',
        answer:
          'No. Privnote has no API. Torch Secret has a REST API for programmatic secret creation and retrieval.',
      },
      {
        question: 'Can I self-host Privnote?',
        answer:
          'No. Privnote can only be used at privnote.com. Torch Secret can be self-hosted via Docker Compose.',
      },
      {
        question: 'Is Privnote free?',
        answer: "Yes, but ad-supported. Torch Secret's core functionality is free and ad-free.",
      },
      {
        question: 'What is the Privnote phishing clone problem?',
        answer:
          "Multiple lookalike domains (slight misspellings of privnote.com) serve identical interfaces designed to intercept notes. Because Privnote is closed source and single-hosted, users have no easy way to distinguish authentic from clone. Torch Secret's open source nature and self-hosting option reduce this risk significantly.",
      },
    ],
  },
};
