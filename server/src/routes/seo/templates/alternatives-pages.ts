/**
 * Alternatives competitor page data for SSR routes at /alternatives/:competitor.
 *
 * Content sourced from .claude/competitor-pages/alternatives-*.md files.
 * Each entry contains:
 *   - meta: SEO metadata (title, canonical, description, OG tags)
 *   - bodyHtml: full semantic HTML for the <main> body (narrative prose, recommendation table, CTA)
 *   - faqItems: FAQ question/answer pairs for FAQPage JSON-LD in <head> (NOT rendered in body)
 *
 * Design intent: persuasive prose narrative style — "why people look for [Competitor] alternatives"
 * followed by an alternatives list and recommendation-by-use-case table.
 */

interface AlternativesPageData {
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
const H3 = (text: string) => `<h3 class="ssr-h3">${text}</h3>`;
const P = (text: string) => `<p class="ssr-p">${text}</p>`;
const STRONG = (text: string) => `<strong class="ssr-strong">${text}</strong>`;
const HR = `<hr class="ssr-hr" />`;
const UL_OPEN = `<ul class="ssr-ul">`;
const UL_CLOSE = `</ul>`;
const LI = (text: string) => `<li class="ssr-li">${text}</li>`;

export const ALTERNATIVES_PAGES: Record<string, AlternativesPageData> = {
  onetimesecret: {
    meta: {
      title: 'Best OneTimeSecret Alternatives in 2026',
      canonical: 'https://torchsecret.com/alternatives/onetimesecret',
      metaDesc:
        "Looking for a OneTimeSecret alternative? Here are the best options — including tools with zero-knowledge encryption, open source code, and team features OTS doesn't have.",
      ogTitle: 'The Best OneTimeSecret Alternatives',
      ogDesc:
        "OneTimeSecret encrypts on the server. If that's not good enough for your threat model, here are the alternatives that are.",
    },
    bodyHtml: `
${CARD_OPEN}
${H1('Best OneTimeSecret Alternatives in 2026')}
${P(`OneTimeSecret pioneered the one-time link format for sharing secrets. It's been around since 2011, it works, and many teams use it without issue. But it has a specific limitation that security-conscious users have grown more aware of: ${STRONG('it encrypts on the server')}, which means their server handles your plaintext before encryption.`)}
${P("If that's the limitation you're running into — or if you need team features, view receipts, or a lower price point than their $35/month Identity Plus plan — here are the best alternatives.")}
${CARD_CLOSE}

${H2('What to evaluate when switching')}
${P('Before choosing an alternative, be clear on which limitation you are actually solving for:')}
${P(`${STRONG('Encryption model:')} Does the tool encrypt in your browser (zero-knowledge) or on the server? Server-side encryption is still encrypted — but the service provider can read your secret. Client-side means even a full server compromise reveals nothing.`)}
${P(`${STRONG('Open source:')} Can you audit the security claims? For tools handling sensitive credentials, unaudited "trust us" claims are a risk.`)}
${P(`${STRONG('Team features:')} OneTimeSecret has no team tier. If you need shared dashboards, usage analytics, or multi-user access, look for tools that have it.`)}
${P(`${STRONG('Price:')} OneTimeSecret's free tier is rate-limited; their paid tier ($35/month) is primarily for custom domains. If you don't need branding, there are cheaper paths to more features.`)}
${P(`${STRONG('API:')} OneTimeSecret has a well-known API. If you're integrating into existing workflows, verify your alternative has API access.`)}

${HR}

${H2('The best OneTimeSecret alternatives')}

${H3('1. Torch Secret — Best for zero-knowledge encryption')}
${P(`${STRONG('URL:')} torchsecret.com | ${STRONG('Pricing:')} Free (anonymous), $7/month Pro, $29/month Team`)}
${P('Torch Secret is the most direct upgrade from OneTimeSecret if your reason for switching is the server-side encryption model. The core function is identical: paste a secret, get a link, share it, it disappears after one view. The difference is architectural.')}
${P(`${STRONG('How it works:')} AES-256-GCM encryption runs in your browser using the Web Crypto API. The encryption key is generated locally and embedded only in the URL fragment (<code>#key</code>). Per HTTP spec, URL fragments are never transmitted to servers — our server receives only the encrypted ciphertext. We cannot read what we store.`)}
${P(`${STRONG('What you get beyond OneTimeSecret:')}`)}
${UL_OPEN}
${LI('True zero-knowledge — verifiable via open source code')}
${LI('View receipts — know when your secret was opened (Pro)')}
${LI("Secret history — review what you've sent (Pro)")}
${LI('Team dashboard — shared visibility for your team (Team plan)')}
${LI('Free tier with no rate limits (anonymous use)')}
${LI('PADME padding — prevents ciphertext length from leaking secret length')}
${UL_CLOSE}
${P(`${STRONG("What OneTimeSecret has that Torch Secret doesn't yet:")}`)}
${UL_OPEN}
${LI("Custom domains (on OTS's $35/month plan)")}
${LI('Email delivery of secret links')}
${UL_CLOSE}
${P(`${STRONG('Best for:')} Developers, security teams, DevOps engineers sharing actual credentials where server trust is unacceptable.`)}

${HR}

${H3('2. Password Pusher (pwpush.com) — Best for self-hosting with audit logs')}
${P(`${STRONG('URL:')} pwpush.com | ${STRONG('Pricing:')} Free (self-host), $19/month Premium, $29/month Pro`)}
${P(`Password Pusher is the most feature-rich tool in this category. It has AES-256-GCM encryption, audit logs, file sharing, and a unique "Requests" feature that lets you send a secure link to someone so they can upload a secret to you — useful for collecting credentials from clients or contractors.`)}
${P(`${STRONG('What it does better than OneTimeSecret:')}`)}
${UL_OPEN}
${LI('Audit logs (paid) — full view trail with timestamps')}
${LI('File sharing (paid) — not just text')}
${LI('View count expiration — expire after N views, not just first view')}
${LI('Requests — collect secrets inbound (paid)')}
${LI('Team features (Pro plan)')}
${UL_CLOSE}
${P(`${STRONG('Key limitation:')} Like OneTimeSecret, encryption is server-side. If zero-knowledge is your reason for switching, Password Pusher doesn't solve it.`)}
${P(`${STRONG('Best for:')} Organizations that need compliance-grade audit logs, file sharing, or inbound secret collection. Especially attractive if you're self-hosting.`)}

${HR}

${H3('3. Privnote — Best for casual, non-technical use cases')}
${P(`${STRONG('URL:')} privnote.com | ${STRONG('Pricing:')} Free (ad-supported)`)}
${P("Privnote is the simplest tool in the category. It's free, requires no account, and the interface is extremely minimal. It claims browser-side encryption with the key in the URL fragment.")}
${P(`${STRONG('Caveats:')} Privnote is closed source — you cannot verify the security claims. It's also ad-supported, and there's a documented problem with phishing clone sites (lookalike domains with near-identical interfaces designed to intercept notes). There's no API, no password protection (only a reference phrase), and no self-hosting.`)}
${P(`${STRONG('Best for:')} Low-stakes notes where the audience is non-technical and the content doesn't justify rigorous security verification.`)}

${HR}

${H3('4. Cryptgeon — Best for self-hosted zero-knowledge')}
${P(`${STRONG('URL:')} github.com/cupcakearmy/cryptgeon | ${STRONG('Pricing:')} Free (self-host only)`)}
${P('Cryptgeon is an open source tool written in Rust and Svelte that offers client-side encryption and self-hosting. If you want to run your own zero-knowledge secret sharing instance with no third-party infrastructure dependency, Cryptgeon is worth evaluating. No hosted public instance is available — you deploy it yourself.')}
${P(`${STRONG('Best for:')} Organizations that want to self-host a zero-knowledge tool and prefer not to run a Node.js/PostgreSQL stack.`)}

${HR}

${H3('5. scrt.link — Best for zero-knowledge with a hosted option')}
${P(`${STRONG('URL:')} scrt.link | ${STRONG('Pricing:')} Free tier available`)}
${P("scrt.link offers end-to-end encrypted one-time secret sharing with client-side encryption. It's a more recent entrant and has a hosted option. Worth evaluating as an alternative if you want zero-knowledge without self-hosting.")}
${P(`${STRONG('Best for:')} Users who want a hosted zero-knowledge option and want an alternative to both OTS and Torch Secret.`)}

${HR}

${H2('Which alternative is right for you?')}
<div class="ssr-overflow">
<table>
  <thead>
    <tr>
      <th>Situation</th>
      <th>Recommendation</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>OTS's server-side encryption is the problem</td><td>Torch Secret</td></tr>
    <tr><td>You need team features + view receipts</td><td>Torch Secret (Pro/Team)</td></tr>
    <tr><td>You need audit logs for compliance</td><td>Password Pusher (Pro)</td></tr>
    <tr><td>You need to receive secrets inbound</td><td>Password Pusher (Requests)</td></tr>
    <tr><td>You need file sharing</td><td>Password Pusher (Premium)</td></tr>
    <tr><td>You want to self-host + zero-knowledge</td><td>Torch Secret or Cryptgeon</td></tr>
    <tr><td>You're sharing casual, low-stakes notes</td><td>Privnote (if non-technical audience)</td></tr>
    <tr><td>The OTS $35/month plan is too expensive</td><td>Torch Secret ($7/month Pro)</td></tr>
  </tbody>
</table>
</div>

${HR}

${H2('Try Torch Secret')}
${P('The zero-knowledge alternative to OneTimeSecret. Free to use, no account required.')}
${P("Your secret is encrypted in your browser. We receive only the ciphertext. When it's opened once, it's gone from our servers permanently.")}
${CTA_BUTTON}
<a href="/vs/onetimesecret" class="ssr-link-inline">Compare Torch Secret vs. OneTimeSecret in detail &rarr;</a>
    `,
    faqItems: [
      {
        question: 'Why do people look for OneTimeSecret alternatives?',
        answer:
          'The most common reasons: (1) OneTimeSecret encrypts server-side, so the server can read your secrets before encrypting them; (2) the paid tier ($35/month) is expensive for what it offers — primarily custom domains; (3) no team features or view receipts at any tier.',
      },
      {
        question: 'Is there a free OneTimeSecret alternative?',
        answer:
          'Yes. Torch Secret has a free hosted tier with no rate limits for anonymous use. Password Pusher is free if you self-host. Privnote is free but ad-supported.',
      },
      {
        question: "What's the most secure OneTimeSecret alternative?",
        answer:
          'Tools with client-side (zero-knowledge) encryption: Torch Secret (hosted + open source), Cryptgeon (self-hosted only), or scrt.link. These tools encrypt in your browser — the server never sees your plaintext.',
      },
      {
        question: 'Does any OneTimeSecret alternative have team features?',
        answer:
          'Yes. Torch Secret (Team plan at $29/month) and Password Pusher (Pro plan at $29/month) both have team dashboards and multi-user access.',
      },
      {
        question: 'Can I get view receipts in any OneTimeSecret alternative?',
        answer:
          "Yes. Torch Secret Pro ($7/month) includes view receipts — you'll know when your specific secret was opened. Password Pusher's paid plans also include audit logs.",
      },
    ],
  },

  pwpush: {
    meta: {
      title: 'Best Password Pusher Alternatives in 2026',
      canonical: 'https://torchsecret.com/alternatives/pwpush',
      metaDesc:
        "Looking for a Password Pusher alternative? Compare tools with zero-knowledge encryption, free hosted tiers, and team features — including options that don't require self-hosting.",
      ogTitle: 'The Best Password Pusher Alternatives',
      ogDesc:
        'Password Pusher is powerful but server-side and requires self-hosting for free access. Here are the best alternatives.',
    },
    bodyHtml: `
${CARD_OPEN}
${H1('Best Password Pusher Alternatives in 2026')}
${P('Password Pusher is one of the most capable tools in the one-time secret sharing category. It\'s open source, actively maintained, and offers features most competitors don\'t — file sharing, audit logs, and a "Requests" feature for collecting secrets inbound.')}
${P('But there are two reasons people look for alternatives:')}
${UL_OPEN}
${LI(`${STRONG('Encryption model:')} Password Pusher uses AES-256-GCM server-side. The server handles your plaintext before encrypting it. If you need a tool that encrypts in your browser — where the server genuinely cannot read your secret — pwpush does not offer that.`)}
${LI(`${STRONG('No free hosted tier:')} If you want to use Password Pusher for free, you self-host it. If you want hosted access without running infrastructure, the entry point is $19/month.`)}
${UL_CLOSE}
${P("If either of those is why you're looking, here are the best alternatives.")}
${CARD_CLOSE}

${H2('What to evaluate when switching')}
${P(`${STRONG('Encryption model:')} Does the tool encrypt in your browser (zero-knowledge) or server-side? Password Pusher's AES-256-GCM is server-side. Tools that encrypt in the browser ensure the server genuinely cannot read stored secrets.`)}
${P(`${STRONG('Free hosted option:')} Do you need a hosted solution without running infrastructure? Many tools in this category require self-hosting for free access.`)}
${P(`${STRONG('Features you actually use:')} Password Pusher has file sharing, audit logs, Requests, and view count expiration. If you rely on these, verify the alternative has them or has a reasonable roadmap.`)}
${P(`${STRONG('Self-hosting:')} If you're already self-hosting pwpush, is switching to another self-hosted tool worth it? Factor in migration cost.`)}

${HR}

${H2('The best Password Pusher alternatives')}

${H3('1. Torch Secret — Best for zero-knowledge + free hosted access')}
${P(`${STRONG('URL:')} torchsecret.com | ${STRONG('Pricing:')} Free (anonymous), $7/month Pro, $29/month Team`)}
${P("If the server-side encryption is why you're switching, Torch Secret is the most direct answer. It handles the same core job — share a secret once, it disappears — but with client-side AES-256-GCM. The encryption key exists only in the URL fragment and never reaches our server. We store only ciphertext.")}
${P(`${STRONG('Where Torch Secret improves on Password Pusher:')}`)}
${UL_OPEN}
${LI(`${STRONG('Zero-knowledge:')} Server is architecturally incapable of reading stored secrets`)}
${LI(`${STRONG('Free hosted tier:')} Unlimited anonymous secrets, no account, no self-hosting`)}
${LI(`${STRONG('Simpler UX:')} Minimal, single-purpose interface — no feature sprawl`)}
${LI(`${STRONG('View receipts:')} Know exactly when your specific secret was opened (Pro)`)}
${LI(`${STRONG('Lower price:')} $7/month Pro vs. $19/month Premium for hosted access`)}
${UL_CLOSE}
${P(`${STRONG('Where Password Pusher has the edge:')}`)}
${UL_OPEN}
${LI('File sharing (paid)')}
${LI('Inbound secret collection via Requests (paid)')}
${LI('View count expiration (expire after N views)')}
${LI('Compliance-grade audit logs (paid)')}
${LI('Larger self-hosting community and documentation')}
${UL_CLOSE}
${P(`${STRONG('Best for:')} Developers and security teams sharing text-based credentials where zero-knowledge is required and file sharing isn't needed.`)}

${HR}

${H3('2. OneTimeSecret — Best for the simplest possible tool')}
${P(`${STRONG('URL:')} onetimesecret.com | ${STRONG('Pricing:')} Free (rate-limited), $35/month Identity Plus`)}
${P("OneTimeSecret is the other major player in this space. It has a clean interface, a well-documented REST API, and has been around since 2011. It's more widely recognized than Password Pusher outside of self-hosting circles.")}
${P(`${STRONG('What it does better than Password Pusher for some users:')}`)}
${UL_OPEN}
${LI('Cleaner, more minimal UX')}
${LI('Email delivery feature (send the link to a recipient by email)')}
${LI('Well-recognized brand — some organizations trust it by default')}
${UL_CLOSE}
${P(`${STRONG('Key limitation:')} Like Password Pusher, OneTimeSecret is server-side encrypted. If zero-knowledge is your requirement, OTS also doesn't solve it. And their paid tier ($35/month) is primarily for custom domains — there are no audit logs, no team features, no view receipts at any price.`)}
${P(`${STRONG('Best for:')} Teams that want a recognized, minimal tool and don't need self-hosting or advanced features.`)}

${HR}

${H3('3. Privnote — Best for casual non-technical use cases')}
${P(`${STRONG('URL:')} privnote.com | ${STRONG('Pricing:')} Free (ad-supported)`)}
${P("Privnote is extremely simple. No API, no self-hosting, no team features. It claims browser-side encryption, but because it's closed source, those claims can't be verified.")}
${P("Worth mentioning here for completeness, but if you were using Password Pusher's more advanced features, Privnote is a step down in capability, not a lateral move.")}
${P(`${STRONG('Best for:')} Low-stakes, casual note sharing with non-technical audiences.`)}

${HR}

${H3('4. Cryptgeon — Best for self-hosted zero-knowledge')}
${P(`${STRONG('URL:')} github.com/cupcakearmy/cryptgeon | ${STRONG('Pricing:')} Free (self-host only)`)}
${P("Cryptgeon is an open source Rust + Svelte tool with client-side encryption. If you're already running your own infrastructure and want to switch from a self-hosted pwpush instance to a self-hosted zero-knowledge alternative, Cryptgeon is worth a look. It's simpler than Password Pusher (no file sharing, no audit logs) but cleaner and architecturally stronger on the encryption model.")}
${P(`${STRONG('Best for:')} Organizations self-hosting a secret sharing tool who want zero-knowledge and don't need audit logs or file sharing.`)}

${HR}

${H3("5. Vault (HashiCorp) — Best if one-time sharing isn't the right tool at all")}
${P("If your team is passing around API keys and passwords regularly, the real answer might not be a one-time secret tool at all. HashiCorp Vault and AWS Secrets Manager provide persistent, auditable, access-controlled secret storage. They're more complex to operate, but they're the right tool for teams that need to manage credentials long-term, not just share them once.")}
${P("This isn't an alternative to Password Pusher so much as an honest note: if you're handling credentials at scale, ephemeral sharing is a workflow patch, not an architecture.")}
${P(`${STRONG('Best for:')} Organizations that need persistent credential management, rotation, audit trails, and access control — not one-time sharing.`)}

${HR}

${H2('Which alternative is right for you?')}
<div class="ssr-overflow">
<table>
  <thead>
    <tr>
      <th>Situation</th>
      <th>Recommendation</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>Server-side encryption is the problem</td><td>Torch Secret</td></tr>
    <tr><td>Need a free hosted option (no self-hosting)</td><td>Torch Secret</td></tr>
    <tr><td>Need zero-knowledge + self-hosting</td><td>Torch Secret or Cryptgeon</td></tr>
    <tr><td>Need audit logs for compliance</td><td>Stay with Password Pusher (Pro)</td></tr>
    <tr><td>Need file sharing</td><td>Stay with Password Pusher</td></tr>
    <tr><td>Need inbound secret collection (Requests)</td><td>Stay with Password Pusher</td></tr>
    <tr><td>Need simpler UX, less feature sprawl</td><td>Torch Secret or OneTimeSecret</td></tr>
    <tr><td>Credential management, not just sharing</td><td>HashiCorp Vault</td></tr>
  </tbody>
</table>
</div>

${HR}

${H2('Try Torch Secret')}
${P('Free, hosted, zero-knowledge. No self-hosting required. No account required.')}
${P('Your secret is encrypted in your browser before anything is transmitted. We store only the ciphertext. On first view, the record is permanently deleted.')}
${CTA_BUTTON}
<a href="/vs/pwpush" class="ssr-link-inline">Compare Torch Secret vs. Password Pusher in detail &rarr;</a>
    `,
    faqItems: [
      {
        question: 'Why do people look for Password Pusher alternatives?',
        answer:
          "The two most common reasons: (1) Password Pusher uses server-side encryption — the server handles plaintext before encrypting, which isn't zero-knowledge; (2) there is no free hosted tier — free use requires running your own instance, which is a hosting and maintenance burden.",
      },
      {
        question: 'Is there a free hosted alternative to Password Pusher?',
        answer:
          'Yes. Torch Secret has a free hosted tier with no account required, unlimited anonymous secrets, and no self-hosting needed. OneTimeSecret also has a free hosted tier (rate-limited).',
      },
      {
        question: "What's the zero-knowledge alternative to Password Pusher?",
        answer:
          'Torch Secret (hosted) or Cryptgeon (self-hosted). Both use client-side encryption, meaning the server stores only ciphertext and is architecturally incapable of decrypting stored secrets.',
      },
      {
        question: 'Does any Password Pusher alternative support file sharing?',
        answer:
          "Not among the common one-time secret tools. Password Pusher's file sharing is relatively unique in this category. For file sharing with security requirements, consider secure file transfer tools like Tresorit, Keybase, or Signal — or self-hosted options like Nextcloud with E2E encryption.",
      },
      {
        question: 'Can I get audit logs in a Password Pusher alternative?',
        answer:
          'Torch Secret Pro includes view receipts per secret. For team-level compliance audit logs, Password Pusher Pro currently has the most comprehensive feature in the category.',
      },
    ],
  },

  privnote: {
    meta: {
      title: 'Best Privnote Alternatives in 2026',
      canonical: 'https://torchsecret.com/alternatives/privnote',
      metaDesc:
        "Privnote is closed source and ad-supported — you can't verify its security claims. Here are the best Privnote alternatives, including open source and zero-knowledge options.",
      ogTitle: 'The Best Privnote Alternatives',
      ogDesc:
        "Privnote's encryption can't be audited. Here are alternatives with open source code, verified zero-knowledge encryption, and no ads.",
    },
    bodyHtml: `
${CARD_OPEN}
${H1('Best Privnote Alternatives in 2026')}
${P("Privnote has been around long enough that many people reach for it by default when they need to share a self-destructing note. It's free, requires no account, and the UX is minimal.")}
${P('But people look for alternatives for specific reasons:')}
${UL_OPEN}
${LI(`${STRONG('Unverifiable encryption:')} Privnote claims browser-side AES-256, but it's closed source. You cannot audit the code, verify the claim, or confirm plaintext doesn't also pass through their server.`)}
${LI(`${STRONG('Ad-supported:')} Ads on a tool you're using to share credentials is an uncomfortable trust mismatch.`)}
${LI(`${STRONG('No API:')} No programmatic access — only the web interface.`)}
${LI(`${STRONG('No real password protection:')} The "reference phrase" is an identity hint, not a cryptographic second factor.`)}
${LI(`${STRONG('Phishing clone problem:')} Lookalike domains (privnot.com, privnotes.com, etc.) with identical interfaces exist specifically to intercept notes.`)}
${UL_CLOSE}
${P("If any of those are why you're looking, here are the best alternatives.")}
${CARD_CLOSE}

${H2('What matters when choosing a Privnote replacement')}
${P(`${STRONG('Open source:')} With security tools, "trust us" is not a security model. Open source code lets you — or a security researcher you trust — verify that the tool does what it claims.`)}
${P(`${STRONG('Encryption location:')} Client-side encryption (in your browser) means the server never sees your plaintext. Server-side encryption means you're trusting the service provider. Know which model each tool uses.`)}
${P(`${STRONG('No ads:')} If you are handling API keys and credentials, ad networks — even indirectly — should not be in the picture.`)}
${P(`${STRONG('Password protection:')} A second factor on a secret means even if the link is intercepted, the secret requires an additional credential to reveal. Not all tools offer this as a real cryptographic layer.`)}
${P(`${STRONG('API:')} If you are a developer who wants to integrate secret sharing into workflows, you need a tool with an API.`)}

${HR}

${H2('The best Privnote alternatives')}

${H3('1. Torch Secret — Best overall: open source, zero-knowledge, ad-free')}
${P(`${STRONG('URL:')} torchsecret.com | ${STRONG('Pricing:')} Free (anonymous, no account), $7/month Pro`)}
${P('Torch Secret does exactly what Privnote does — but with verifiable, auditable security. The full source code is on GitHub. You can confirm that:')}
${UL_OPEN}
${LI('AES-256-GCM encryption runs in your browser using the Web Crypto API')}
${LI('The encryption key is generated locally and embedded only in the URL fragment')}
${LI('The URL fragment is never transmitted to the server (per HTTP spec, RFC 3986)')}
${LI('The server stores only the encrypted ciphertext')}
${LI('The secret is atomically deleted on first retrieval')}
${UL_CLOSE}
${P(`${STRONG('What Torch Secret adds beyond Privnote:')}`)}
${UL_OPEN}
${LI(`${STRONG('Open source')} — audit the security claims yourself`)}
${LI(`${STRONG('API')} — integrate into CI/CD, onboarding flows, scripts`)}
${LI(`${STRONG('Real password protection')} — Argon2id second factor, not just a reference phrase`)}
${LI(`${STRONG('No ads')} — free tier is ad-free`)}
${LI(`${STRONG('Self-hosting')} — run your own instance, eliminate all third-party dependency`)}
${LI(`${STRONG('View receipts')} — know when your secret was opened (Pro)`)}
${LI(`${STRONG('Secret history')} — review what you've sent (Pro)`)}
${LI(`${STRONG('PADME padding')} — ciphertext length doesn't leak secret length`)}
${UL_CLOSE}
${P(`${STRONG("What Privnote has that Torch Secret doesn't:")}`)}
${UL_OPEN}
${LI(`Email notification to sender on note destruction (Privnote's "notify me" feature)`)}
${UL_CLOSE}
${P(`${STRONG('Best for:')} Anyone switching from Privnote for security or verification reasons. Especially good for developers and technical users who need an API or password protection.`)}

${HR}

${H3('2. OneTimeSecret — Best for non-technical simplicity with a trusted brand')}
${P(`${STRONG('URL:')} onetimesecret.com | ${STRONG('Pricing:')} Free (rate-limited), $35/month Identity Plus`)}
${P('OneTimeSecret is the most widely recognized tool in this space. Clean interface, no account required for recipients, long track record.')}
${P(`${STRONG('The limitation:')} Encryption is server-side — their server handles your plaintext before encrypting it. This is a step up from Privnote's unverifiable claim in one sense (OTS is open source, and you can verify the deletion mechanism), but it's not zero-knowledge.`)}
${P(`${STRONG('Best for:')} Teams who want the most recognized, widely-used tool and aren't concerned about server-side encryption. Also good if you want an email delivery feature (send the link by email from within the product).`)}

${HR}

${H3('3. Password Pusher (pwpush.com) — Best for teams with compliance needs')}
${P(`${STRONG('URL:')} pwpush.com | ${STRONG('Pricing:')} Free (self-host), $19/month Premium hosted`)}
${P("Password Pusher has more features than either Privnote or OneTimeSecret: audit logs, file sharing, inbound collection (Requests), and view count expiration. It's overkill if you were using Privnote for casual notes, but if your use case has grown into something that requires compliance documentation, it's worth evaluating.")}
${P(`${STRONG('The limitation:')} Server-side encryption, same as OTS. Not zero-knowledge.`)}
${P(`${STRONG('Best for:')} Teams who need audit logs, file sharing, or the Requests feature — and are comfortable with server-side encryption.`)}

${HR}

${H3('4. Signal — Best for ongoing secure messaging (different tool for different job)')}
${P("If you're using Privnote because you need messages that disappear and you're doing this regularly with the same people, Signal is a better choice. It's open source, end-to-end encrypted, and has disappearing messages built in.")}
${P(`Privnote and Torch Secret are for one-off credential delivery, not ongoing conversation. If the use case is "we message regularly and want messages to disappear," Signal handles that more elegantly.`)}
${P(`${STRONG('Best for:')} Recurring secure communication with a known set of people.`)}

${HR}

${H3('5. Cryptgeon — Best for technical users who self-host')}
${P(`${STRONG('URL:')} github.com/cupcakearmy/cryptgeon | ${STRONG('Pricing:')} Free (self-host only)`)}
${P("Cryptgeon is an open source Rust + Svelte tool with client-side encryption and a clean UI. No hosted public instance — self-host only. If you want to run your own verified zero-knowledge instance and you're already comfortable with Docker, this is worth evaluating.")}
${P(`${STRONG('Best for:')} Technical users who want to self-host a verified zero-knowledge alternative and prefer to eliminate all third-party dependency.`)}

${HR}

${H2('Which alternative is right for you?')}
<div class="ssr-overflow">
<table>
  <thead>
    <tr>
      <th>Situation</th>
      <th>Recommendation</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>Closed source was the problem</td><td>Torch Secret or OneTimeSecret (both open source)</td></tr>
    <tr><td>Need verifiable zero-knowledge</td><td>Torch Secret</td></tr>
    <tr><td>Ads are the problem</td><td>Torch Secret (free, no ads)</td></tr>
    <tr><td>Need an API</td><td>Torch Secret or OneTimeSecret</td></tr>
    <tr><td>Need real password protection</td><td>Torch Secret</td></tr>
    <tr><td>Sharing low-stakes notes, non-technical audience</td><td>OneTimeSecret (simpler brand recognition)</td></tr>
    <tr><td>Need audit logs or file sharing</td><td>Password Pusher</td></tr>
    <tr><td>Regular secure messaging, not one-time</td><td>Signal</td></tr>
    <tr><td>Want full control, self-host everything</td><td>Torch Secret or Cryptgeon</td></tr>
    <tr><td>Worried about phishing clones</td><td>Torch Secret (self-hostable + open source)</td></tr>
  </tbody>
</table>
</div>

${HR}

${H2('The phishing clone problem')}
${P(`A significant risk with Privnote specifically: there are multiple active phishing domains — sites with near-identical names and interfaces — designed to intercept your notes before they're "encrypted" or redirect you after capturing the content.`)}
${P("Because Privnote is closed source and hosted on a single domain, it's difficult to verify you're on the real site. The interface looks the same whether you're on privnote.com or a lookalike domain.")}
${P('With open source tools, this risk is manageable: you can verify the domain, read the source code, and optionally self-host to eliminate the third-party entirely. Self-hosted Torch Secret means the only phishing risk is someone impersonating your own domain — which you control.')}

${HR}

${H2('Try Torch Secret')}
${P('Open source. Ad-free. Zero-knowledge. No account required.')}
${P('Encryption runs in your browser before anything reaches our server. You can read the code and verify that claim before you use it.')}
${CTA_BUTTON}
<a href="/vs/privnote" class="ssr-link-inline">Compare Torch Secret vs. Privnote in detail &rarr;</a>
    `,
    faqItems: [
      {
        question: 'Why do people look for Privnote alternatives?',
        answer: `The most common reasons: (1) Privnote is closed source — you can't verify its encryption claims; (2) it's ad-supported, which feels wrong for a credentials tool; (3) no API for developers; (4) the "reference phrase" isn't real password protection; (5) phishing clone domains with identical interfaces.`,
      },
      {
        question: "Is there a free Privnote alternative that's open source?",
        answer:
          'Yes. Torch Secret is free (anonymous tier, no account required) and fully open source. OneTimeSecret is also open source and free.',
      },
      {
        question: "What's the most secure Privnote alternative?",
        answer:
          'Torch Secret — open source, client-side encryption, verifiable zero-knowledge. You can read the encryption module and confirm the server never receives your plaintext. Cryptgeon is also worth considering for self-hosted deployments.',
      },
      {
        question: 'Does any Privnote alternative have an API?',
        answer:
          'Yes. Torch Secret and OneTimeSecret both have REST APIs for programmatic secret creation and retrieval. Password Pusher also has an API.',
      },
      {
        question: 'Is Privnote safe to use?',
        answer:
          "Security researchers have raised concerns: (1) the code isn't open source, so claims can't be verified; (2) phishing clone domains are a documented active threat. For sharing actual credentials, you want a tool with auditable code.",
      },
    ],
  },
};
