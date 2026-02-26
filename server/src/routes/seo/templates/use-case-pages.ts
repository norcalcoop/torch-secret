/**
 * Use-case page data for SSR routes at /use/:slug and /use/ (hub).
 *
 * Content sourced from .claude/use-case-pages.md.
 * Each entry contains:
 *   - meta: SEO metadata (title, canonical, description, OG tags)
 *   - h1: page H1 heading (also used as HowTo schema name)
 *   - description: one-sentence TL;DR for HowTo JSON-LD description
 *   - bodyHtml: full rendered HTML body (including visible FAQ section)
 *   - steps: HowTo step-by-step data for JSON-LD
 *   - faqItems: FAQ question/answer pairs for FAQPage JSON-LD (also visible in body)
 *
 * USE_CASE_HUB provides metadata and card data for the /use/ hub page.
 */

import { escHtml } from './layout.js';

interface HowToStep {
  name: string;
  text: string;
}

interface UseCasePageData {
  meta: {
    title: string;
    canonical: string;
    metaDesc: string;
    ogTitle: string;
    ogDesc: string;
  };
  h1: string;
  description: string;
  bodyHtml: string;
  steps: HowToStep[];
  faqItems: Array<{ question: string; answer: string }>;
}

interface HubCardData {
  slug: string;
  title: string;
  description: string;
}

export const USE_CASE_HUB = {
  meta: {
    title: 'Use Cases — How Teams Share Credentials Securely with Torch Secret',
    canonical: 'https://torchsecret.com/use/',
    metaDesc:
      'One-time encrypted links for every credential sharing scenario: API keys, SSH keys, database passwords, .env files, and more. No accounts. No trace.',
    ogTitle: 'Secure Credential Sharing Guides',
    ogDesc:
      'Learn how to share sensitive credentials securely without email or Slack. One-time encrypted links that self-destruct after one view.',
  },
  cards: [
    {
      slug: 'share-api-keys',
      title: 'Share API Keys Securely',
      description: 'Encrypted one-time links for API keys — no Slack history, no email archive.',
    },
    {
      slug: 'share-database-credentials',
      title: 'Share Database Credentials',
      description: 'Share database passwords without them living in message history.',
    },
    {
      slug: 'share-ssh-keys',
      title: 'Share SSH Keys Without Email or Slack',
      description: 'Get SSH private keys to teammates without insecure channels.',
    },
    {
      slug: 'send-password-without-email',
      title: 'Send a Password Without Email',
      description: 'One-time links that expire after opening — safer than email.',
    },
    {
      slug: 'share-credentials-without-slack',
      title: 'Share Credentials Without Slack',
      description: 'Keep credentials out of Slack message history and search indexes.',
    },
    {
      slug: 'share-env-file',
      title: 'Share a .env File Securely',
      description: 'Share environment variables with developers via self-destructing links.',
    },
    {
      slug: 'share-credentials-with-contractor',
      title: 'Share Credentials with a Contractor',
      description: 'Give contractors access without credentials persisting after the project.',
    },
    {
      slug: 'onboarding-credential-handoff',
      title: 'Credential Handoff During Onboarding',
      description: 'IT admins: securely hand off passwords to new employees at scale.',
    },
  ] as HubCardData[],
};

// ---------------------------------------------------------------------------
// Shared style helpers (same as vs-pages.ts for visual consistency)
// ---------------------------------------------------------------------------

const CTA_BUTTON = `<a href="/create" style="display:inline-block;margin-top:2rem;border-radius:0.5rem;background:var(--ds-color-accent);padding:0.75rem 1.5rem;font-weight:600;color:#fff;text-decoration:none;transition:background 0.15s;" onmouseover="this.style.background='var(--ds-color-accent-hover)'" onmouseout="this.style.background='var(--ds-color-accent)'">Create a secure link &rarr;</a>`;

const CARD_OPEN = `<div style="border-radius:0.75rem;border:1px solid var(--ds-color-border);background:var(--ds-color-surface);padding:2rem;margin-bottom:2rem;">`;
const CARD_CLOSE = `</div>`;

const H1 = (text: string) =>
  `<h1 style="font-size:1.875rem;font-weight:700;color:var(--ds-color-text-primary);margin-bottom:1rem;line-height:1.25;">${text}</h1>`;
const H2 = (text: string) =>
  `<h2 style="font-size:1.25rem;font-weight:600;color:var(--ds-color-text-primary);margin-top:2.5rem;margin-bottom:0.75rem;">${text}</h2>`;
const P = (text: string) =>
  `<p style="color:var(--ds-color-text-secondary);line-height:1.7;margin-bottom:1rem;">${text}</p>`;
const STRONG = (text: string) =>
  `<strong style="color:var(--ds-color-text-primary);">${text}</strong>`;
const HR = `<hr style="border:none;border-top:1px solid var(--ds-color-border);margin:2rem 0;" />`;
const UL_OPEN = `<ul style="list-style:disc;padding-left:1.5rem;margin-bottom:1rem;display:flex;flex-direction:column;gap:0.25rem;">`;
const UL_CLOSE = `</ul>`;
const LI = (text: string) => `<li style="color:var(--ds-color-text-secondary);">${text}</li>`;

/** Render a numbered step list item */
const OL_OPEN = `<ol style="list-style:decimal;padding-left:1.5rem;margin-bottom:1rem;display:flex;flex-direction:column;gap:0.75rem;">`;
const OL_CLOSE = `</ol>`;

/** Render a visible FAQ section as a definition list */
function renderFaq(items: Array<{ question: string; answer: string }>): string {
  const rows = items
    .map(
      (item) => `
  <div style="margin-bottom:1.25rem;">
    <dt style="font-weight:600;color:var(--ds-color-text-primary);margin-bottom:0.375rem;">${escHtml(item.question)}</dt>
    <dd style="color:var(--ds-color-text-secondary);line-height:1.7;margin:0;">${escHtml(item.answer)}</dd>
  </div>`,
    )
    .join('');
  return `<dl style="margin:0;">${rows}</dl>`;
}

/** Render a "Related guides" link row */
function renderRelated(links: Array<{ slug: string; label: string }>): string {
  const anchors = links
    .map(
      (l) =>
        `<a href="/use/${escHtml(l.slug)}" style="color:var(--ds-color-accent);">${escHtml(l.label)}</a>`,
    )
    .join(' &middot; ');
  return `<p style="color:var(--ds-color-text-muted);font-size:0.875rem;margin-top:1rem;">${anchors}</p>`;
}

// ---------------------------------------------------------------------------
// Page 1: share-api-keys
// ---------------------------------------------------------------------------

const shareApiKeysFaq = [
  {
    question: 'Can I share multiple API keys in one link?',
    answer:
      'Yes. Paste all of them into a single secret — the service name, the key, the environment, any notes. It all encrypts as one blob.',
  },
  {
    question: 'Does Torch Secret log which API key I shared?',
    answer:
      'No. The server stores only the encrypted ciphertext. The server never sees the plaintext key. Log files contain no secret content — secret IDs are even redacted from URL logs.',
  },
  {
    question: 'What if my recipient accidentally opens the link before they are ready?',
    answer:
      'Add a password. They will need to enter it before the key is revealed, which prevents accidental reveals and adds a second factor. If the key is consumed accidentally, generate a fresh secret.',
  },
  {
    question: 'What if the link expires before my recipient opens it?',
    answer:
      'The encrypted record is deleted on expiration. Generate a new secret with a longer expiration and share a fresh link.',
  },
  {
    question: 'How is this different from encrypting an email with PGP?',
    answer:
      'PGP-encrypted email still sits in both inboxes indefinitely. The key is protected in transit, but the email itself remains permanently stored. Torch Secret destroys the record on first view — there is no permanent copy.',
  },
];

const shareApiKeysSteps: HowToStep[] = [
  {
    name: 'Paste your API key',
    text: 'Open Torch Secret and paste your API key into the text field. You can include the service name, scope, and which environment in the same secret.',
  },
  {
    name: 'Set an expiration',
    text: 'Choose how long the link remains valid: 1 hour for urgent handoffs, 24 hours for same-day async, 7 days for async workflows. If the link expires before it is opened, it is deleted.',
  },
  {
    name: 'Add a password (optional)',
    text: 'For highly sensitive keys, add a password the recipient must enter before the key is revealed. Share the password over a separate channel.',
  },
  {
    name: 'Copy the secure link',
    text: 'Share it however is convenient — Slack, email, text, Jira ticket. The actual key is never in the channel. Only the link is.',
  },
  {
    name: 'Recipient opens and decrypts',
    text: 'Your recipient clicks the link. Their browser fetches the encrypted blob and decrypts it locally. They copy the API key. The server record is permanently deleted.',
  },
  {
    name: 'Verify and rotate if needed',
    text: 'After sharing, confirm with your recipient that they received it. If they have trouble, generate a new secret. Rotate the old key if you are concerned it was exposed.',
  },
];

// ---------------------------------------------------------------------------
// Page 2: share-database-credentials
// ---------------------------------------------------------------------------

const shareDbFaq = [
  {
    question: 'Can I include the full connection string in one secret?',
    answer:
      "Yes. Paste the entire string — postgresql://username:password@host:5432/dbname — as a single secret. Add a note about which environment it's for if helpful.",
  },
  {
    question: 'What if I need to share the same credentials with multiple people?',
    answer:
      'Generate a separate secret for each recipient. Each link is one-time. This also gives you a clear record of who received which set of credentials.',
  },
  {
    question: 'Does the server ever see the database password?',
    answer:
      'No. Encryption happens in your browser before anything is transmitted. The server stores only the encrypted ciphertext and the IV. It has no decryption key.',
  },
  {
    question:
      'What if the recipient accidentally opens the link before they are ready to copy the credentials?',
    answer:
      "Add a password. They must enter the password before the secret is revealed, which prevents accidental reveals. If it's consumed, generate a new secret and rotate the credentials if you have concerns.",
  },
  {
    question: 'How does this compare to using a secrets manager?',
    answer:
      "Secrets managers (Vault, AWS Secrets Manager) are the right tool for applications to retrieve credentials programmatically. Torch Secret is the right tool for humans to share credentials with other humans. They're complementary — you might use Torch Secret to share the Vault master password with a new team member.",
  },
];

const shareDbSteps: HowToStep[] = [
  {
    name: 'Prepare the credential payload',
    text: 'Format your database credentials clearly — include the host, port, database name, username, and password in one secret. You can also include notes about environment (staging vs. production) and access scope.',
  },
  {
    name: 'Set a short expiration',
    text: 'Database credentials warrant urgency. Use 1–24 hours unless your recipient is in a significantly different timezone. If the link expires unopened, the encrypted record is deleted automatically.',
  },
  {
    name: 'Consider adding a password',
    text: 'For production credentials, add a password protection layer. Share the secret link via Slack and the unlock password via a different channel. The attacker needs both.',
  },
  {
    name: 'Share the link',
    text: 'Send the Torch Secret link to your recipient. The actual credentials are not in the Slack message or email — only the link is.',
  },
  {
    name: 'Confirm receipt',
    text: 'Follow up to confirm your recipient opened and saved the credentials. If they had trouble, generate a new secret.',
  },
  {
    name: 'Rotate on the old schedule',
    text: 'Sharing credentials via Torch Secret does not eliminate the need for periodic rotation. But it does mean you are not accumulating plaintext copies of current credentials in archived chat logs.',
  },
];

// ---------------------------------------------------------------------------
// Page 3: share-ssh-keys
// ---------------------------------------------------------------------------

const shareSshFaq = [
  {
    question: 'Can I share the SSH key and the passphrase in one secret?',
    answer:
      'Yes. Paste both into a single Torch Secret — the key, the passphrase, and any installation instructions. It all encrypts as one blob.',
  },
  {
    question: "What's the size limit for a secret?",
    answer:
      'Torch Secret handles typical SSH private key sizes (a few kilobytes) without issue. There is no limit that would affect standard RSA, ECDSA, or Ed25519 key files.',
  },
  {
    question: 'Should I delete the private key after sharing it?',
    answer:
      "If you're sharing someone else's key that was generated for them, yes — delete your local copy after the link is created. If you're distributing your own key, the local copy is your source of truth; only the Torch Secret link needs to disappear.",
  },
  {
    question: 'What if I need to share the same SSH key with multiple recipients?',
    answer:
      'Generate a separate Torch Secret for each recipient. Each link is single-use. Better practice, however, is to generate a unique key pair per person and add each public key to authorized_keys individually — this makes individual access revocation trivial.',
  },
  {
    question: 'How is this different from using SSH certificates?',
    answer:
      "SSH certificates are the right long-term architecture for organizations managing many users. Torch Secret is the right tool for the initial credential delivery — sharing the certificate, the signing key, or the temporary private key for one-time setup. They're complementary.",
  },
];

const shareSshSteps: HowToStep[] = [
  {
    name: 'Paste the private key contents',
    text: 'Open Torch Secret and paste the full contents of the private key file — including the BEGIN and END markers. You can add a note about which server(s) the key authorizes and where to install it.',
  },
  {
    name: 'Set a short expiration',
    text: 'SSH private keys warrant a short expiration window: 1–4 hours if you are coordinating in real time, 24 hours if the handoff is async. If the link expires, the record is deleted automatically.',
  },
  {
    name: 'Add a password',
    text: 'For server access credentials, use password protection. Share the Torch Secret link over Slack and the unlock password via a text message or phone call. This means an attacker with access to only one channel cannot retrieve the key.',
  },
  {
    name: 'Share the link',
    text: 'Send the Torch Secret link to your recipient. The private key is not in the message — only the link is.',
  },
  {
    name: 'Confirm and rotate',
    text: "Confirm your recipient received and installed the key. After sharing, schedule rotation of the private key after the immediate need is met. Treat the shared private key as provisionally compromised until you've verified the recipient has it securely stored.",
  },
];

// ---------------------------------------------------------------------------
// Page 4: send-password-without-email
// ---------------------------------------------------------------------------

const sendPasswordFaq = [
  {
    question: "What if the recipient doesn't know what a Torch Secret link is?",
    answer:
      'The reveal page is clear and requires one click to reveal the password. No account, no install, no technical knowledge required. Most recipients figure it out in under 10 seconds.',
  },
  {
    question: 'Can I include the username and service in the same secret?',
    answer:
      'Yes. Paste everything — username, password, service URL, notes — as a single secret. It all encrypts together.',
  },
  {
    question:
      'What if the recipient accidentally opens the link and closes the tab without copying the password?',
    answer:
      'The secret is consumed on open — it cannot be re-revealed. Generate a new secret with the password and share a fresh link.',
  },
  {
    question: "Is Torch Secret more secure than a password manager's sharing feature?",
    answer:
      "Password managers (1Password, Bitwarden) are excellent for sharing credentials with people who use the same service. Torch Secret covers the case where the recipient doesn't have an account — the link works for anyone.",
  },
  {
    question:
      'What if I need to send a password to someone who uses an end-to-end encrypted email service like ProtonMail?',
    answer:
      'E2E encrypted email protects the message in transit and at rest, which is genuinely better than standard email. Torch Secret adds one property E2E encrypted email does not have: the secret is permanently deleted on first view. After the recipient reads it, there is no copy anywhere.',
  },
];

const sendPasswordSteps: HowToStep[] = [
  {
    name: 'Create the secret',
    text: 'Paste the password into Torch Secret. You can include the username, the service, and any notes in the same secret — all encrypted together.',
  },
  {
    name: 'Set an expiration',
    text: '1 hour for urgent delivery, 24 hours for same-day async, 7 days for longer async windows. If the link expires before it is opened, the record is deleted.',
  },
  {
    name: 'Optionally add a password',
    text: 'You can add a Torch Secret password as a second authentication layer. Share the unlock password over a different channel — a phone call, a text, in person.',
  },
  {
    name: 'Share the link via email',
    text: 'Send the Torch Secret link in your email. The actual password is not in the email body. The email now contains only a link to a one-time encrypted delivery.',
  },
  {
    name: 'Recipient opens the link',
    text: 'They click the link, see the password once, copy it, and the record is gone. They should save the password to a password manager immediately — they will not be able to return to the link.',
  },
];

// ---------------------------------------------------------------------------
// Page 5: share-credentials-without-slack
// ---------------------------------------------------------------------------

const shareWithoutSlackFaq = [
  {
    question: 'Can I delete the Torch Secret link from Slack after the recipient opens it?',
    answer:
      'Yes — though the link is already inert once opened. But cleaning up the message is still a good habit, and there is no reason to leave even a dead link around.',
  },
  {
    question: "What about Slack's own password-protected messages feature?",
    answer:
      "Slack doesn't have a native password-protected message feature. Individual messages cannot be encrypted differently from the rest of the workspace. The only options are workspace-level encryption (which Slack manages, not you) or not putting credentials in Slack at all.",
  },
  {
    question: "What if we use Slack's Enterprise Key Management (EKM)?",
    answer:
      "EKM lets your organization manage Slack's encryption keys, giving you control over which Slack data can be read by Slack employees. It is a meaningful security upgrade. It doesn't change the fact that credentials in your Slack message history are visible to your Slack workspace admins and anyone with EKM key access.",
  },
  {
    question: "What if the person who needs the credential doesn't have Slack?",
    answer:
      'Torch Secret links work from any browser. If they are outside your Slack workspace, send the link via email, SMS, or any other channel.',
  },
  {
    question: 'How long does the link stay valid after I share it?',
    answer:
      'You set the expiration when creating the secret — 1 hour, 24 hours, or 7 days. After the expiration, or after the first view, the record is permanently deleted.',
  },
];

const shareWithoutSlackSteps: HowToStep[] = [
  {
    name: 'Create the secret',
    text: 'Open Torch Secret. Paste the credential — API key, password, connection string, whatever it is. Add context in the same secret if helpful.',
  },
  {
    name: 'Set an expiration',
    text: 'For Slack-based handoffs, 1–4 hours works for real-time coordination. 24 hours for async same-day delivery. The expiration is a safety net: if the link is never opened, the encrypted record self-destructs on schedule.',
  },
  {
    name: 'Add a password (for sensitive credentials)',
    text: 'If the credential is particularly sensitive, add a Torch Secret password. Share the Torch Secret link in Slack, and communicate the unlock password via a different channel. An attacker with access to only your Slack history cannot retrieve the credential.',
  },
  {
    name: 'Send the link in Slack',
    text: 'Paste the Torch Secret link into the Slack DM or channel. The message now contains only a link — no credential, no plaintext.',
  },
  {
    name: 'Recipient opens the link',
    text: 'They click it, see the credential, copy it, and the record is gone. If anyone searches Slack for the credential after this point, they will find the link — and nothing at the other end.',
  },
];

// ---------------------------------------------------------------------------
// Page 6: share-env-file
// ---------------------------------------------------------------------------

const shareEnvFaq = [
  {
    question: 'How large can the secret be? My .env file is several kilobytes.',
    answer:
      'Torch Secret handles .env files of any typical size without issue — even files with dozens of variables and long key values.',
  },
  {
    question: 'Should I share the full .env or only the variables the developer needs?',
    answer:
      "Share only what the recipient needs for their role. If a frontend developer doesn't need the database password, don't include it. Principle of least privilege applies here too.",
  },
  {
    question:
      'What happens if I share a .env file and later realize it had production credentials in it?',
    answer:
      'Rotate all the credentials in that .env file immediately. If the link was opened, treat all credentials in the file as compromised. Generate new API keys, rotate database passwords, re-sign your auth secret.',
  },
  {
    question: 'Is this better than using a .env.example file and sharing actual values separately?',
    answer:
      'A .env.example with placeholders is excellent practice — it documents what is needed without exposing real values. Torch Secret is how you deliver the real values securely, as a complement to that workflow.',
  },
  {
    question: "What's better long-term than Torch Secret for .env sharing?",
    answer:
      'Tools like Doppler, Infisical, or HashiCorp Vault let teams manage secrets centrally, with role-based access and audit logs. Torch Secret is the right tool for one-time delivery during the bootstrap phase, or for organizations that have not yet implemented a full secrets management platform.',
  },
];

const shareEnvSteps: HowToStep[] = [
  {
    name: 'Copy the .env file contents',
    text: 'Open the file locally and copy the full contents. Do not attach the file to any email or upload it to any file sharing service — paste the contents directly into Torch Secret.',
  },
  {
    name: 'Review before sharing',
    text: "Before creating the secret, confirm you are sharing the right environment's .env file. Accidentally sharing production credentials when you meant staging is a meaningful error.",
  },
  {
    name: 'Use a short expiration with password protection',
    text: 'For .env files, use maximum caution: set a 1–4 hour expiration and add a password. Share the Torch Secret link via one channel and the unlock password via a different channel. The attacker needs both.',
  },
  {
    name: 'Share the link',
    text: 'Send the Torch Secret link via Slack or email. The file contents are not in the message — only the link is.',
  },
  {
    name: 'Confirm receipt and rotate a subset',
    text: 'Confirm your recipient opened the link and has the credentials. Consider rotating the highest-privilege credentials after sharing, treating the .env file as provisionally compromised until you have confirmed secure receipt.',
  },
  {
    name: 'Set up a secrets management workflow for the future',
    text: ".env file sharing is a bootstrap problem. Consider this the last time you share a raw .env file. Going forward, evaluate tools like Doppler, Vault, or your cloud provider's secrets manager for team-wide credential distribution.",
  },
];

// ---------------------------------------------------------------------------
// Page 7: share-credentials-with-contractor
// ---------------------------------------------------------------------------

const shareContractorFaq = [
  {
    question: 'Should I give contractors their own accounts or share team credentials?',
    answer:
      'Whenever possible, create a dedicated account or credential for the contractor. This gives you a clean revocation path — you disable that account when the engagement ends rather than rotating a shared credential. Torch Secret is then how you deliver that dedicated credential.',
  },
  {
    question: "What if I need to share credentials with multiple people on a contractor's team?",
    answer:
      'Generate a separate Torch Secret for each person. Each link is single-use. You will know exactly who received which credentials.',
  },
  {
    question:
      "Can I set a Torch Secret link to automatically expire at the end of the contractor's engagement?",
    answer:
      "Torch Secret expiration options are time-based (1 hour, 24 hours, 7 days), not calendar-based. Use the 7-day option for longer-lead deliveries, or generate the link close to when it's needed. Regardless of expiration, rotate credentials at engagement end.",
  },
  {
    question:
      'What if the contractor needs to re-access credentials after losing them during the engagement?',
    answer:
      'The one-time link cannot be re-opened. Generate a new secret with the same credentials and share a fresh link. If the credentials are sensitive, consider this an opportunity to rotate them and deliver new ones.',
  },
  {
    question: 'We have a secrets manager. Why would we use Torch Secret?',
    answer:
      "Secrets managers handle application-to-application credential retrieval. Torch Secret handles human-to-human credential delivery — specifically, the bootstrap problem of getting credentials to a person who doesn't yet have access to your secrets manager. They're complementary.",
  },
];

const shareContractorSteps: HowToStep[] = [
  {
    name: 'Scope the credentials',
    text: 'Before creating the secret, determine what access the contractor actually needs. Principle of least privilege: give them the staging database password, not the production one. A read-only API key, not a full-access key.',
  },
  {
    name: 'Create the secret',
    text: 'Paste the credentials into Torch Secret. Include context about what each credential is and where it is used — the contractor may not be familiar with your stack.',
  },
  {
    name: 'Set an expiration',
    text: 'Match the expiration to your delivery timeline. For contractor onboarding, 24 hours is typically appropriate. If the contractor has not opened the link by the time it expires, generate a new one and reach out.',
  },
  {
    name: 'Add a password',
    text: 'For contractor credentials, use a password. Share the Torch Secret link via email and the unlock password via a separate channel — a phone call, a text to their personal number.',
  },
  {
    name: 'Share and confirm',
    text: 'Send the link. Follow up to confirm they opened it and have what they need.',
  },
  {
    name: 'Rotate on engagement end',
    text: "When the contractor's work is complete, rotate all credentials you shared. Because delivery was via Torch Secret, you are not chasing down 'did they delete the email?' — the only copy was the one-time link, which is already gone.",
  },
];

// ---------------------------------------------------------------------------
// Page 8: onboarding-credential-handoff
// ---------------------------------------------------------------------------

const onboardingFaq = [
  {
    question: "How do we handle the case where a new hire can't open the link before it expires?",
    answer:
      'Generate a new secret with the same credential and share a fresh link. If this happens frequently, use a 7-day expiration instead.',
  },
  {
    question: 'Should we use Torch Secret for all onboarding credentials, or just sensitive ones?',
    answer:
      'Start with the most sensitive credentials — VPN, staging environment databases, any shared service with broad access. Extending it to all credentials is better practice, but prioritize the high-value ones first.',
  },
  {
    question:
      'What about credentials that need to be shared with the whole team, not just new hires?',
    answer:
      'Torch Secret is for point-to-point delivery. For team-wide credential management — shared credentials everyone on the team needs — a team password manager (1Password Teams, Bitwarden for Business) is the right tool. Use Torch Secret to onboard new employees into the password manager, not to replace it.',
  },
  {
    question:
      'Does Torch Secret integrate with our onboarding platform (e.g., Rippling, Workday, BambooHR)?',
    answer:
      "Torch Secret doesn't have native integrations with HR platforms. It works as a standalone web tool — the IT admin creates links manually and includes them in whatever onboarding communication they are already sending. For high-volume onboarding with automated workflows, the Torch Secret API can be integrated into custom tooling.",
  },
  {
    question: "What's the right process for offboarding when Torch Secret was used for onboarding?",
    answer:
      "The offboarding process doesn't change — deactivate accounts, revoke access, collect the device. What Torch Secret eliminates is the 'go check if any credential emails need to be deleted' step, because there are no credential emails.",
  },
];

const onboardingSteps: HowToStep[] = [
  {
    name: 'Separate credentials into individual secrets',
    text: "Don't paste all credentials into a single Torch Secret. Create one secret per credential or per logical group (e.g., 'VPN credentials' as one secret, 'Staging environment' as another). This gives the new hire a clear record of what they received.",
  },
  {
    name: 'Set 24–48 hour expirations',
    text: 'Onboarding is chaotic. Give the new hire time to open each link — 24 or 48 hours. Remind them to open each one before it expires.',
  },
  {
    name: 'Send the links via your onboarding channel',
    text: 'Send the Torch Secret links via whatever channel your onboarding process uses — email, Slack, your onboarding platform. The link is not sensitive; only the content behind the link is.',
  },
  {
    name: 'Remind the new hire to save credentials to a password manager',
    text: "Each Torch Secret link is single-use. Once it is opened, it is gone. The new hire should save each credential to your organization's password manager immediately on reveal.",
  },
  {
    name: 'Confirm all links have been opened',
    text: 'Follow up to confirm the new hire has opened and saved all credentials. If any links expired, generate new ones.',
  },
  {
    name: 'Rotate temporary passwords after first login',
    text: 'Any temporary password you share should be rotated by the new hire at first login. This is standard practice — Torch Secret does not change this, but it does mean the temporary password that was delivered never sat in an inbox.',
  },
];

// ---------------------------------------------------------------------------
// Body HTML builders
// ---------------------------------------------------------------------------

function buildShareApiKeysBody(): string {
  return `
${CARD_OPEN}
${H1('How to Share API Keys Securely')}
${P(`${STRONG('TL;DR:')} Paste your API key into Torch Secret, share the one-time link, and the key is permanently deleted the moment your recipient opens it. No Slack history. No email archive. No trace.`)}
${CARD_CLOSE}

${H2('The problem with how API keys get shared')}
${P('You need to get an API key to a developer, a contractor, or a colleague. You paste it into Slack or fire it off in an email.')}
${P('This is how almost everyone does it. It also means your API key now lives permanently in:')}
${UL_OPEN}
${LI('Your Slack message history, searchable by any workspace admin')}
${LI('Your sent mail folder, indefinitely')}
${LI("Your recipient's inbox, indefinitely")}
${LI('Any email archive your organization retains for compliance')}
${LI('Any third-party Slack integration that has read access to your channels')}
${UL_CLOSE}
${P('Slack messages and emails do not disappear when you forget about them. And API keys are the kind of credential that sits in those archives long after you have forgotten they existed.')}

${HR}

${H2("What's at stake")}
${P('A leaked API key is not a low-severity event:')}
${UL_OPEN}
${LI(`${STRONG('Unauthorized charges:')} A leaked AWS or Stripe key can drain your account overnight`)}
${LI(`${STRONG('Data breach:')} A database API key gives an attacker read/write access to production data`)}
${LI(`${STRONG('Service compromise:')} A third-party integration key exposes your entire data pipeline`)}
${LI(`${STRONG('Compliance violation:')} Many compliance frameworks (SOC 2, HIPAA, PCI-DSS) treat uncontrolled credential exposure as an incident`)}
${UL_CLOSE}
${P('GitHub runs automated secret scanning on public commits for this reason. It still finds 10 million exposed secrets per year.')}

${HR}

${H2('The solution')}
${P('Torch Secret is a zero-knowledge, one-time secret sharing tool built specifically for this workflow.')}
${P('Your API key is encrypted in your browser using AES-256-GCM before it ever reaches the server. The encryption key lives only in the URL fragment, which per HTTP spec (RFC 3986) is never transmitted to any server. Your recipient opens the link, their browser decrypts the key locally, and the server record is immediately and permanently deleted.')}
${P('The server never holds anything decryptable. A full database dump reveals only encrypted ciphertext with no keys to decrypt it.')}

${HR}

${H2('How to share an API key securely (step by step)')}
${OL_OPEN}
${LI(`${STRONG('Paste your API key:')} Open Torch Secret, paste your API key into the text field. You can include multiple keys or add context in the same secret.`)}
${LI(`${STRONG('Set an expiration:')} Choose how long the link remains valid — 1 hour for urgent handoffs, 24 hours for same-day async, 7 days for async workflows.`)}
${LI(`${STRONG('Add a password (optional):')} For highly sensitive keys, add a password the recipient must enter before the key is revealed. Share the password over a separate channel.`)}
${LI(`${STRONG('Copy the secure link:')} Share it however is convenient — Slack, email, text. The actual key is never in the channel. Only the link is.`)}
${LI(`${STRONG('Recipient opens and decrypts:')} Their browser fetches the encrypted blob and decrypts it locally. They copy the API key. The server record is permanently deleted.`)}
${LI(`${STRONG('Verify and rotate if needed:')} Confirm your recipient received it. If they have trouble, generate a new secret. Rotate the old key if concerned.`)}
${OL_CLOSE}

${HR}

${H2('Why zero-knowledge matters specifically for API keys')}
${P("When you paste an API key into Slack, the key is stored as plaintext on Slack's servers. Slack admins can read it. Third-party apps connected to your workspace may have read access. If Slack's infrastructure is ever breached, your key is in the leak.")}
${P("With Torch Secret, the server never sees the plaintext API key at any point. What's stored is an encrypted blob produced by your browser. Without the URL fragment — which is never logged by any server — the blob is permanently undecryptable. Even if Torch Secret's database were fully compromised, the attacker would have ciphertext with no keys.")}
${P("This isn't a marketing claim. It's a consequence of the architecture. The code is open source — you can verify it.")}

${HR}

${H2('Who uses Torch Secret for API key sharing')}
${UL_OPEN}
${LI(`${STRONG('Developers')} handing off service credentials to teammates during sprint onboarding`)}
${LI(`${STRONG('DevOps engineers')} delivering cloud API keys (AWS, GCP, Azure) to contractors`)}
${LI(`${STRONG('Engineering leads')} sharing third-party integration keys (Stripe, Twilio, SendGrid) with new team members`)}
${LI(`${STRONG('Freelancers')} receiving client API keys at project start — one-time delivery, then the link is gone`)}
${LI(`${STRONG('Security teams')} distributing temporary credentials for penetration testing engagements`)}
${UL_CLOSE}

${HR}

${H2('Frequently asked questions')}
${renderFaq(shareApiKeysFaq)}

${HR}

${P('No account. No install. Paste your API key, get a link. The key is encrypted in your browser before it reaches our servers. We store only ciphertext. When the link is opened once, the record is permanently and atomically deleted.')}
${CTA_BUTTON}

${HR}

${H2('Related guides')}
${renderRelated([
  { slug: 'share-database-credentials', label: 'Share Database Credentials Securely' },
  { slug: 'share-credentials-with-contractor', label: 'Share Credentials with a Contractor' },
  { slug: 'share-ssh-keys', label: 'Share SSH Keys Securely' },
])}
`;
}

function buildShareDbBody(): string {
  return `
${CARD_OPEN}
${H1('How to Share Database Credentials Securely')}
${P(`${STRONG('TL;DR:')} Database credentials are the keys to all your data. Sharing them over Slack or email leaves a permanent copy in message history. Torch Secret encrypts them in your browser, delivers them once, and permanently destroys the record.`)}
${CARD_CLOSE}

${H2('The problem')}
${P('A developer joins the team. They need the database connection string. Someone pastes it into Slack.')}
${P('This is standard. It is also one of the most dangerous credential sharing patterns in software teams.')}
${P('Database credentials are the highest-privilege secrets most developers handle. And when those credentials are shared over Slack or email:')}
${UL_OPEN}
${LI('They sit in your Slack message history, searchable by any workspace admin')}
${LI('Every admin in your Slack organization can read private DMs')}
${LI('Your email client retains a copy in your sent folder indefinitely')}
${LI("The recipient's inbox retains a copy indefinitely")}
${LI("If either person's email account is ever compromised, so is your database")}
${UL_CLOSE}

${HR}

${H2("What's at stake")}
${P('A leaked database credential is not a minor incident:')}
${UL_OPEN}
${LI(`${STRONG('Full data exposure:')} An attacker with your production database password has access to every record you have ever stored`)}
${LI(`${STRONG('Write access:')} They can modify, corrupt, or delete data — not just read it`)}
${LI(`${STRONG('Compliance breach:')} GDPR, HIPAA, SOC 2, and PCI-DSS all treat exposed production credentials as reportable incidents`)}
${LI(`${STRONG('Cascading impact:')} Most applications have a single database user with broad permissions — one leaked credential often means total data access`)}
${UL_CLOSE}
${P('The problem compounds over time. The credential shared in a Slack DM two years ago is still there, in the thread, searchable and readable by whoever currently has admin access.')}

${HR}

${H2('The solution')}
${P('Torch Secret generates a zero-knowledge one-time link. Paste your database credentials, send the link, and the record is permanently deleted the moment your recipient opens it.')}
${P("The server holds only an encrypted blob. The decryption key lives only in the URL fragment, which is never transmitted to any server. A full database dump of Torch Secret's infrastructure reveals nothing decryptable.")}

${HR}

${H2('How to share database credentials (step by step)')}
${OL_OPEN}
${LI(`${STRONG('Prepare the credential payload:')} Include the host, port, database name, username, and password in one secret. Add notes about environment and access scope.`)}
${LI(`${STRONG('Set a short expiration:')} Database credentials warrant urgency. Use 1–24 hours unless your recipient is in a significantly different timezone.`)}
${LI(`${STRONG('Consider adding a password:')} For production credentials, add a password protection layer. Share the link via Slack and the unlock password via a different channel.`)}
${LI(`${STRONG('Share the link:')} Send the Torch Secret link to your recipient. The actual credentials are not in the Slack message or email — only the link is.`)}
${LI(`${STRONG('Confirm receipt:')} Follow up to confirm your recipient opened and saved the credentials.`)}
${LI(`${STRONG('Rotate on the old schedule:')} Sharing via Torch Secret does not eliminate the need for periodic rotation. But it means you are not accumulating plaintext copies in archived chat logs.`)}
${OL_CLOSE}

${HR}

${H2('Why zero-knowledge matters for database credentials')}
${P('Database credentials are specifically targeted in breach scenarios because attackers know that compromising a single credential often means total data access.')}
${P('The relevant threat models:')}
${UL_OPEN}
${LI(`${STRONG('Slack breach:')} Your Slack workspace history is exposed. Any credential shared in any message or DM is now accessible to the attacker.`)}
${LI(`${STRONG('Email breach:')} A compromised email account gives an attacker access to years of sent mail. Credentials in those emails are now in the attacker's hands.`)}
${LI(`${STRONG('Insider threat:')} A disgruntled admin with Slack access can search message history for database credentials shared months or years earlier.`)}
${LI(`${STRONG('Legal discovery:')} In litigation, Slack message exports and email archives are discoverable. Credentials in those archives may be exposed to parties outside your organization.`)}
${UL_CLOSE}
${P("With Torch Secret, the plaintext credential never enters any of these systems. The link in the Slack message leads to an encrypted blob that is deleted on first view. The credential was never in Slack. It wasn't in email. It existed in Torch Secret's database for minutes or hours, as ciphertext, and then it didn't.")}

${HR}

${H2('Who uses Torch Secret for database credential sharing')}
${UL_OPEN}
${LI(`${STRONG('Engineering leads')} delivering staging and production database access to new developers`)}
${LI(`${STRONG('IT admins')} setting up new team members with database access during onboarding`)}
${LI(`${STRONG('DevOps teams')} sharing RDS, Cloud SQL, or Postgres credentials for infrastructure work`)}
${LI(`${STRONG('Contractors')} receiving database access for a specific engagement — one-time delivery, no permanent copy`)}
${LI(`${STRONG('Security engineers')} distributing read-only credentials for audit or penetration testing engagements`)}
${UL_CLOSE}

${HR}

${H2('Frequently asked questions')}
${renderFaq(shareDbFaq)}

${HR}

${P('No account required. No install. Paste the credentials, get a link. The credentials are encrypted in your browser. We store only the encrypted result. When the link is opened once, the record is permanently deleted.')}
${CTA_BUTTON}

${HR}

${H2('Related guides')}
${renderRelated([
  { slug: 'share-api-keys', label: 'Share API Keys Securely' },
  { slug: 'onboarding-credential-handoff', label: 'Share Credentials During Employee Onboarding' },
  { slug: 'share-env-file', label: 'Share a .env File Securely' },
])}
`;
}

function buildShareSshBody(): string {
  return `
${CARD_OPEN}
${H1('How to Share SSH Keys Without Email or Slack')}
${P(`${STRONG('TL;DR:')} An SSH private key in your sent mail folder is a copy of a master key that never goes away. Torch Secret delivers it once, destroys the record on open, and leaves nothing in any archive.`)}
${CARD_CLOSE}

${H2('The problem with emailing SSH keys')}
${P('You need to give someone SSH access to a server. The obvious path: email them the private key, they add it to authorized_keys.')}
${P("The problem: that email is now in your sent folder. It's in their inbox. If either of you is ever breached, the attacker has a copy of the private key.")}
${P('SSH private keys are particularly dangerous to leak because:')}
${UL_OPEN}
${LI("They're long-lived by default — many organizations never rotate them")}
${LI('A single private key may authenticate to multiple servers')}
${LI('Identifying which servers the key authorizes is often non-trivial')}
${LI("Rotating an SSH key means updating authorized_keys on every server it's deployed on")}
${UL_CLOSE}
${P('One leaked private key, combined with the human tendency to never rotate SSH credentials, is a very durable access vector for an attacker.')}

${HR}

${H2("What's at stake")}
${UL_OPEN}
${LI(`${STRONG('Persistent unauthorized access:')} An attacker with your SSH private key can silently authenticate to any server that trusts it, for as long as the key is not rotated`)}
${LI(`${STRONG('Lateral movement:')} From one server, an attacker with SSH access can often pivot to others on the same network`)}
${LI(`${STRONG('Compromised infrastructure:')} Production servers, build systems, deployment pipelines — all accessible via SSH`)}
${LI(`${STRONG('No audit trail:')} SSH key authentication often produces less logging than password authentication; access via a stolen key may go unnoticed`)}
${UL_CLOSE}

${HR}

${H2('The solution')}
${P('Torch Secret delivers SSH private keys as zero-knowledge one-time links.')}
${P('Paste the private key contents, share the link, and your recipient downloads and saves the key. The record is permanently deleted the moment the link is opened. Anyone who finds the link later — in an email thread, a Slack archive, a browser history — sees nothing.')}
${P('The key is encrypted in your browser before it ever reaches the Torch Secret server. The server stores only the ciphertext. The decryption key lives only in the URL fragment, which is never transmitted to any server per HTTP spec.')}

${HR}

${H2('How to share an SSH key (step by step)')}
${OL_OPEN}
${LI(`${STRONG('Paste the private key contents:')} Open Torch Secret and paste the full contents of the private key file — including the BEGIN and END markers. Add a note about which server(s) the key authorizes and where to install it.`)}
${LI(`${STRONG('Set a short expiration:')} SSH private keys warrant a short expiration window: 1–4 hours if coordinating in real time, 24 hours if the handoff is async.`)}
${LI(`${STRONG('Add a password:')} For server access credentials, use password protection. Share the Torch Secret link over Slack and the unlock password via a text message or phone call.`)}
${LI(`${STRONG('Share the link:')} Send the Torch Secret link to your recipient. The private key is not in the message — only the link is.`)}
${LI(`${STRONG('Confirm and rotate:')} Confirm your recipient received and installed the key. Schedule rotation of the private key after the immediate need is met.`)}
${OL_CLOSE}

${HR}

${H2('Why zero-knowledge matters for SSH keys')}
${P('The threat model for SSH keys is different from API keys or passwords.')}
${P('With an API key, you can rotate it in seconds — invalidate the old key in the service dashboard, issue a new one. The window of exposure is bounded by how quickly you act.')}
${P('With SSH private keys, rotation is operationally expensive. Every server that trusts the key needs its authorized_keys updated. Many organizations skip rotation entirely because of this cost. This means a private key shared in an email three years ago may still be a valid entry point today.')}
${P('When you share via Torch Secret, the private key is never stored in any email inbox or Slack message. There is no accumulated archive of plaintext SSH keys to clean up.')}

${HR}

${H2('Who uses Torch Secret for SSH key sharing')}
${UL_OPEN}
${LI(`${STRONG('DevOps and SRE teams')} granting server access to new engineers during onboarding`)}
${LI(`${STRONG('System administrators')} delivering jumpbox or bastion host credentials to contractors for a specific engagement`)}
${LI(`${STRONG('Developers')} handing off deployment access during team handoffs or off-boarding`)}
${LI(`${STRONG('Security engineers')} delivering SSH access for penetration testing engagements with a defined scope and time window`)}
${UL_CLOSE}

${HR}

${H2('Frequently asked questions')}
${renderFaq(shareSshFaq)}

${HR}

${P('No account. No install. Paste the private key contents, get a one-time link. The key is encrypted in your browser. The server stores only ciphertext. When the link is opened once, the record is permanently deleted.')}
${CTA_BUTTON}

${HR}

${H2('Related guides')}
${renderRelated([
  { slug: 'share-api-keys', label: 'Share API Keys Securely' },
  { slug: 'share-credentials-with-contractor', label: 'Share Credentials with a Contractor' },
  { slug: 'share-database-credentials', label: 'Share Database Credentials Securely' },
])}
`;
}

function buildSendPasswordBody(): string {
  return `
${CARD_OPEN}
${H1('How to Send a Password Without Email')}
${P(`${STRONG('TL;DR:')} Email stores a permanent copy of every password you have ever sent — in your sent folder, in the recipient's inbox, and in any archive either organization maintains. Torch Secret delivers a password once and destroys it.`)}
${CARD_CLOSE}

${H2('The problem with emailing passwords')}
${P("You need to send someone a password. It's a one-time thing. You type it into an email.")}
${P("It's now in five places:")}
${OL_OPEN}
${LI('Your sent mail folder (indefinitely)')}
${LI("Your email provider's servers (indefinitely, or per your retention policy)")}
${LI("Your recipient's inbox (indefinitely)")}
${LI("Their email provider's servers (indefinitely)")}
${LI('Any compliance archives either organization maintains')}
${OL_CLOSE}
${P("The password you sent is not a one-time event. It's a persistent record distributed across systems you don't control.")}

${HR}

${H2('Why email password delivery is a compounding risk')}
${P("Email is not designed for ephemeral data. Messages persist by design — that's the whole value proposition. The risks compound over time:")}
${UL_OPEN}
${LI(`${STRONG('Account compromise:')} When an email account is breached, attackers typically search the mailbox for passwords. Any credential ever sent or received via email is exposed.`)}
${LI(`${STRONG('Password reuse:')} If the password you emailed is reused across services, a single inbox breach exposes multiple accounts.`)}
${LI(`${STRONG('Legal discovery:')} Email archives are routinely subpoenaed in litigation. Passwords in those archives may be visible to attorneys, opposing parties, or court records.`)}
${LI(`${STRONG('Offboarding gaps:')} When an employee leaves, their email account is often archived — not deleted. Passwords shared in their inbox remain accessible to anyone with access to that archive.`)}
${UL_CLOSE}

${HR}

${H2('The solution')}
${P('Torch Secret replaces the email payload with a one-time encrypted link.')}
${P("The password is encrypted in your browser before it's sent to the server. The server stores only the ciphertext. When your recipient opens the link, their browser decrypts the password locally. The server record is immediately and permanently deleted.")}
${P('The email you send contains only a link. Not the password. The link leads to a one-time reveal. After that reveal, there is nothing to find.')}

${HR}

${H2('How to send a password without email (step by step)')}
${OL_OPEN}
${LI(`${STRONG('Create the secret:')} Paste the password into Torch Secret. You can include the username, the service, and any notes in the same secret — all encrypted together.`)}
${LI(`${STRONG('Set an expiration:')} 1 hour for urgent delivery, 24 hours for same-day async, 7 days for longer async windows.`)}
${LI(`${STRONG('Optionally add a password:')} Add a Torch Secret password as a second authentication layer. Share the unlock password over a different channel.`)}
${LI(`${STRONG('Share the link via email:')} Send the Torch Secret link in your email. The actual password is not in the email body — only the link is.`)}
${LI(`${STRONG('Recipient opens the link:')} They click the link, see the password once, copy it, and the record is gone. They should save the password to a password manager immediately.`)}
${OL_CLOSE}

${HR}

${H2('Why zero-knowledge matters here')}
${P('When you send a password over email with TLS, the encryption protects the message in transit. But once the message is delivered, it is stored as plaintext in both mailboxes. TLS protects the journey, not the destination.')}
${P("Torch Secret's zero-knowledge model means the password is encrypted in your browser before it ever reaches Torch Secret's server. The decryption key lives only in the URL fragment, which per HTTP spec (RFC 3986) is never transmitted to any server. After the link is opened, the server record is deleted — there is no permanent copy anywhere.")}

${HR}

${H2('Who uses Torch Secret for password delivery')}
${UL_OPEN}
${LI(`${STRONG('IT admins')} sending temporary passwords to employees during account setup`)}
${LI(`${STRONG('Developers')} sharing staging environment passwords with external contractors`)}
${LI(`${STRONG('Team leads')} delivering shared account credentials to new team members`)}
${LI(`${STRONG('Security-conscious individuals')} sharing account credentials with a family member or trusted contact`)}
${LI(`${STRONG('Service providers')} delivering initial credentials to clients at project handoff`)}
${UL_CLOSE}

${HR}

${H2('Frequently asked questions')}
${renderFaq(sendPasswordFaq)}

${HR}

${P('No account. No install. Paste the password, get a one-time link. The password is encrypted in your browser. The server stores only ciphertext. When the link is opened once, the record is permanently deleted. Your email will contain only a link — not the password.')}
${CTA_BUTTON}

${HR}

${H2('Related guides')}
${renderRelated([
  { slug: 'share-credentials-without-slack', label: 'Share Credentials Without Slack' },
  { slug: 'share-database-credentials', label: 'Share Database Credentials Securely' },
  { slug: 'share-api-keys', label: 'Share API Keys Securely' },
])}
`;
}

function buildShareWithoutSlackBody(): string {
  return `
${CARD_OPEN}
${H1('How to Share Passwords Without Pasting Them in Slack')}
${P(`${STRONG('TL;DR:')} Passwords pasted into Slack live in message history, are readable by workspace admins, and appear in compliance exports. Replace the paste with a Torch Secret link — the credential is never in Slack.`)}
${CARD_CLOSE}

${H2('"I\'ll just Slack it to you"')}
${P("It's the fastest option. Everyone's already in Slack. You paste the password into a DM and it's done in three seconds.")}
${P("The password is now in Slack's message history. Depending on your workspace plan and settings:")}
${UL_OPEN}
${LI("It's searchable by any admin in your organization")}
${LI("It's retained in your workspace message archive, potentially indefinitely")}
${LI("It's included in any compliance message export your organization runs")}
${LI('Any third-party app connected to your Slack workspace with message read permissions may have access to it')}
${LI("If Slack's infrastructure is ever compromised, it's in the data")}
${UL_CLOSE}
${P('That three-second convenience leaves a trace that persists for as long as your workspace does.')}

${HR}

${H2('The specific ways Slack retains your credentials')}
${P(`${STRONG('Message history:')} Free Slack workspaces retain 90 days of message history. Paid plans retain messages indefinitely. If you have not set a short retention policy, that credential is sitting in Slack history right now.`)}
${P(`${STRONG('Admin visibility:')} Workspace owners and admins can access message history across all channels and, in some configurations, direct messages.`)}
${P(`${STRONG('Compliance exports:')} Organizations on Business+ and Enterprise Grid plans can export message data for compliance purposes, including DMs and private channel content.`)}
${P(`${STRONG('Third-party integrations:')} Any Slack app with message history OAuth scopes can read message content. Most organizations have dozens of connected apps; not all are vetted for credential handling.`)}

${HR}

${H2('The solution')}
${P('Torch Secret generates a one-time encrypted link. Send that link in Slack instead of the credential.')}
${P("The credential is never in the Slack message. Only the link is. When your recipient opens the link, their browser decrypts the credential locally. The server record is immediately and permanently deleted. If anyone searches Slack for the credential, the link is there but it's already expired — there's nothing to retrieve.")}

${HR}

${H2('How to share credentials without Slack (step by step)')}
${OL_OPEN}
${LI(`${STRONG('Create the secret:')} Open Torch Secret. Paste the credential — API key, password, connection string, whatever it is. Add context in the same secret if helpful.`)}
${LI(`${STRONG('Set an expiration:')} For Slack-based handoffs, 1–4 hours works for real-time coordination. 24 hours for async same-day delivery.`)}
${LI(`${STRONG('Add a password (for sensitive credentials):')} If the credential is particularly sensitive, add a Torch Secret password. Share the link in Slack, and communicate the unlock password via a different channel.`)}
${LI(`${STRONG('Send the link in Slack:')} Paste the Torch Secret link into the Slack DM or channel. The message now contains only a link — no credential, no plaintext.`)}
${LI(`${STRONG('Recipient opens the link:')} They click it, see the credential, copy it, and the record is gone.`)}
${OL_CLOSE}

${HR}

${H2('Why zero-knowledge matters in the Slack context')}
${P('The key property: the credential is never in Slack. Not masked, not deleted — never present.')}
${P("Slack allows message deletion, but deletion doesn't remove the message from Slack's servers for compliance-retained workspaces — it removes it from the UI. Message exports can still include deleted messages.")}
${P('Torch Secret avoids this entirely by ensuring the credential is never pasted into Slack in the first place. The link in Slack is inert — it points to an encrypted blob that is deleted on first view.')}

${HR}

${H2('Who uses Torch Secret for this')}
${UL_OPEN}
${LI(`${STRONG('Developer teams')} who default to Slack for all internal communication but know they should not paste credentials there`)}
${LI(`${STRONG('IT administrators')} who distribute credentials to team members via Slack during onboarding or access setup`)}
${LI(`${STRONG('DevOps engineers')} who need to share environment-specific secrets across timezone-distributed teams`)}
${LI('Anyone who has ever typed "here\'s the password" in a Slack message and immediately felt bad about it')}
${UL_CLOSE}

${HR}

${H2('Frequently asked questions')}
${renderFaq(shareWithoutSlackFaq)}

${HR}

${P('No account. No install. The credential never goes into Slack. Paste your credential into Torch Secret, get a link, paste the link into Slack. The credential is encrypted in your browser. The server stores only ciphertext. When the link is opened, the record is permanently deleted.')}
${CTA_BUTTON}

${HR}

${H2('Related guides')}
${renderRelated([
  { slug: 'send-password-without-email', label: 'Send a Password Without Email' },
  { slug: 'share-api-keys', label: 'Share API Keys Securely' },
  { slug: 'share-env-file', label: 'Share a .env File Securely' },
])}
`;
}

function buildShareEnvBody(): string {
  return `
${CARD_OPEN}
${H1('How to Share a .env File Securely')}
${P(`${STRONG('TL;DR:')} A .env file contains all of your project's secrets at once — database credentials, API keys, auth secrets. Sharing it over Slack or email leaves a single message that exposes everything simultaneously. Torch Secret encrypts it in your browser and destroys it after one view.`)}
${CARD_CLOSE}

${H2('The most consequential share in software development')}
${P('The .env file is in your .gitignore for a reason. It contains:')}
${UL_OPEN}
${LI('Database connection strings and passwords')}
${LI('Third-party API keys (payment processors, email services, analytics)')}
${LI('Authentication secrets and JWT signing keys')}
${LI('Storage bucket credentials')}
${LI('Encryption keys and initialization vectors')}
${LI('Internal service URLs and credentials')}
${UL_CLOSE}
${P('It is, in a single file, every secret your application needs to function. And when a new developer joins the team — or a contractor is onboarded — someone inevitably says: "I\'ll send you the .env file." Then they paste it into Slack or attach it to an email.')}

${HR}

${H2('Why this is the highest-risk credential sharing scenario')}
${P('A leaked API key is a problem. A leaked .env file is a catastrophe.')}
${P('When a single .env file is exposed:')}
${UL_OPEN}
${LI('Your database is accessible')}
${LI('Your payment processor key can be used for unauthorized charges')}
${LI('Your email service key can be used to send phishing at scale from your domain')}
${LI('Your authentication secrets are compromised — JWTs can be forged')}
${LI('Your storage credentials expose any files in your buckets')}
${UL_CLOSE}
${P('There is no single credential that does as much damage as a full .env file. Yet this is one of the most commonly shared files in software development — often in the most insecure ways possible.')}

${HR}

${H2('The solution')}
${P('Paste the contents of your .env file into Torch Secret. Share the one-time link. The file contents are encrypted in your browser, stored as ciphertext, and permanently deleted the moment your recipient opens the link.')}
${P("The .env file contents are never in your Slack message history. They're never in anyone's sent mail. They existed in Torch Secret's database as an encrypted blob for a few hours, and then they didn't.")}

${HR}

${H2('How to share a .env file (step by step)')}
${OL_OPEN}
${LI(`${STRONG('Copy the .env file contents:')} Open the file locally and copy the full contents. Do not attach the file to any email or upload it to any file sharing service — paste the contents directly into Torch Secret.`)}
${LI(`${STRONG('Review before sharing:')} Confirm you are sharing the right environment's .env file. Accidentally sharing production credentials when you meant staging is a meaningful error.`)}
${LI(`${STRONG('Use a short expiration with password protection:')} For .env files, use maximum caution: set a 1–4 hour expiration and add a password. Share the link via one channel and the unlock password via a different channel.`)}
${LI(`${STRONG('Share the link:')} Send the Torch Secret link via Slack or email. The file contents are not in the message — only the link is.`)}
${LI(`${STRONG('Confirm receipt and rotate a subset:')} Confirm your recipient opened the link and has the credentials. Consider rotating the highest-privilege credentials after sharing.`)}
${LI(`${STRONG('Set up a secrets management workflow for the future:')} Consider this the last time you share a raw .env file. Evaluate tools like Doppler, Vault, or your cloud provider's secrets manager.`)}
${OL_CLOSE}

${HR}

${H2('Why zero-knowledge matters for .env files')}
${P('The threat model is multiplied by the content of the file. Every API key in the .env is a separate blast radius. Every database password is a separate data exposure vector. Every auth secret is a separate session forgery risk.')}
${P("Torch Secret's zero-knowledge model means:")}
${UL_OPEN}
${LI('The file contents are encrypted in your browser using AES-256-GCM before being transmitted')}
${LI('The decryption key lives only in the URL fragment — per HTTP spec, never transmitted to any server')}
${LI("The server stores only the ciphertext — there are no keys on Torch Secret's servers to steal")}
${LI('The ciphertext is permanently deleted on first view')}
${UL_CLOSE}
${P("If Torch Secret's infrastructure were completely compromised tomorrow, the attacker would have an encrypted blob and no decryption key. The dozens of credentials in your .env file are not exposed.")}

${HR}

${H2('Who uses Torch Secret for .env file sharing')}
${UL_OPEN}
${LI(`${STRONG('Lead developers')} onboarding new engineers who need the local development environment setup`)}
${LI(`${STRONG('DevOps engineers')} delivering environment-specific credentials to staging and production environments during initial setup`)}
${LI(`${STRONG('Freelancers')} receiving project credentials from clients at project kickoff`)}
${LI(`${STRONG('Contractors')} who need environment access for a specific engagement and should not retain credentials after it ends`)}
${LI(`${STRONG('Security engineers')} delivering isolated test environment credentials for security review engagements`)}
${UL_CLOSE}

${HR}

${H2('Frequently asked questions')}
${renderFaq(shareEnvFaq)}

${HR}

${P('No account. No install. Paste your .env file contents, get a one-time link. The file contents are encrypted in your browser. The server stores only ciphertext. When the link is opened once, the record is permanently deleted.')}
${CTA_BUTTON}

${HR}

${H2('Related guides')}
${renderRelated([
  { slug: 'share-api-keys', label: 'Share API Keys Securely' },
  { slug: 'share-database-credentials', label: 'Share Database Credentials Securely' },
  { slug: 'share-credentials-with-contractor', label: 'Share Credentials with a Contractor' },
])}
`;
}

function buildShareContractorBody(): string {
  return `
${CARD_OPEN}
${H1('How to Share Credentials with a Contractor Safely')}
${P(`${STRONG('TL;DR:')} Credentials shared with a contractor over Slack or email persist in both of your inboxes long after the engagement ends. Torch Secret delivers them once and destroys the record — when you rotate the credentials at project end, there's nothing to clean up.`)}
${CARD_CLOSE}

${H2('The contractor credential problem')}
${P("You're bringing in a contractor for a specific engagement. They need credentials to do the work: an API key, a database password, a staging environment login, an SSH key for a specific server.")}
${P("The fastest path: send it over email or Slack. The problem isn't during the engagement. It's after.")}
${P("When the contractor's project ends, those credentials are still sitting in your Slack message history, your sent mail folder, and the contractor's inbox. If you forget to rotate them — or rotate some but not others — the contractor still has functional credentials to your systems.")}

${HR}

${H2('Why contractors are a specific risk category')}
${P('Contractors exist outside your normal security perimeter:')}
${UL_OPEN}
${LI("They use devices you don't manage or monitor")}
${LI("Their email accounts are not on your domain and not under your IT team's oversight")}
${LI("They're not covered by your offboarding process")}
${LI("They may work for multiple clients simultaneously — the same machine that accesses your systems also accesses other clients' systems")}
${LI('Their contract relationships are shorter — the relationship that creates accountability ends')}
${UL_CLOSE}
${P('None of this means contractors are malicious. It means the attack surface is different. A compromised contractor laptop is a path into your system if the credentials from six months ago have not been rotated.')}

${HR}

${H2('The solution')}
${P("Torch Secret changes the delivery pattern: instead of sharing credentials in a way that leaves a permanent copy in the contractor's inbox, you deliver them once via a link that destroys itself on open.")}
${P("When the engagement ends, you rotate the credentials. Because the contractor received them via a one-time link — not via email or Slack — there's no copy sitting in their inbox to worry about.")}

${HR}

${H2('How to share credentials with a contractor (step by step)')}
${OL_OPEN}
${LI(`${STRONG('Scope the credentials:')} Determine what access the contractor actually needs. Principle of least privilege: give them the staging database password, not the production one. A read-only API key, not a full-access key.`)}
${LI(`${STRONG('Create the secret:')} Paste the credentials into Torch Secret. Include context about what each credential is and where it is used.`)}
${LI(`${STRONG('Set an expiration:')} For contractor onboarding, 24 hours is typically appropriate. If the contractor has not opened the link by the time it expires, generate a new one and reach out.`)}
${LI(`${STRONG('Add a password:')} For contractor credentials, use a password. Share the Torch Secret link via email and the unlock password via a separate channel.`)}
${LI(`${STRONG('Share and confirm:')} Send the link. Follow up to confirm they opened it and have what they need.`)}
${LI(`${STRONG('Rotate on engagement end:')} When the contractor's work is complete, rotate all credentials you shared. Because delivery was via Torch Secret, there is nothing to chase down.`)}
${OL_CLOSE}

${HR}

${H2('Why zero-knowledge matters in the contractor context')}
${P("Standard email credential delivery creates a durable copy in a system you don't control: the contractor's personal or business email account.")}
${P("When the engagement ends, you can rotate credentials, but you can't delete the email from their inbox. If they have a weak email password, if they reuse a password, if their device is stolen — the email with your credentials is accessible to whoever gets into their account.")}
${P("Torch Secret's zero-knowledge architecture means:")}
${UL_OPEN}
${LI('The credential is encrypted in your browser before being sent to the server')}
${LI('The server stores only the encrypted blob — no plaintext, no keys')}
${LI('The contractor opens the link, the blob is decrypted in their browser, the server record is permanently deleted')}
${LI('There is no copy in their email. There is no copy in your sent mail. There is nothing to clean up.')}
${UL_CLOSE}

${HR}

${H2('Who uses Torch Secret for contractor credential delivery')}
${UL_OPEN}
${LI(`${STRONG('Engineering managers')} setting up contractor access to staging environments at project start`)}
${LI(`${STRONG('IT administrators')} delivering VPN credentials, internal tool logins, or service account passwords to external partners`)}
${LI(`${STRONG('Freelance developers')} receiving client API keys or repository access at the start of an engagement`)}
${LI(`${STRONG('Agencies')} managing credential handoff across multiple client relationships`)}
${LI(`${STRONG('Security teams')} delivering scoped credentials for penetration testing engagements with a defined end date`)}
${UL_CLOSE}

${HR}

${H2('Frequently asked questions')}
${renderFaq(shareContractorFaq)}

${HR}

${P('No account. No install. Create a one-time link, deliver once, rotate at project end. The credential is encrypted in your browser. The server stores only ciphertext. When the link is opened, the record is permanently deleted.')}
${CTA_BUTTON}

${HR}

${H2('Related guides')}
${renderRelated([
  { slug: 'share-env-file', label: 'Share a .env File Securely' },
  { slug: 'share-api-keys', label: 'Share API Keys Securely' },
  { slug: 'share-ssh-keys', label: 'Share SSH Keys Securely' },
])}
`;
}

function buildOnboardingBody(): string {
  return `
${CARD_OPEN}
${H1('How to Share Credentials During Employee Onboarding')}
${P(`${STRONG('TL;DR:')} IT admins typically send new employees 5–15 credentials via email on day one. Those emails persist in both mailboxes indefinitely, and nobody cleans them up during offboarding. Torch Secret delivers each credential once and destroys it.`)}
${CARD_CLOSE}

${H2('The onboarding credential problem')}
${P("Day one of a new employee's tenure typically involves an IT admin sending them: a temporary password for their work account, a VPN credential, a Wi-Fi password, a shared service login, staging environment credentials, and possibly a handful of other credentials for the specific tools they will use.")}
${P("Most of this is delivered via email. The new hire's inbox is now a permanent record of every credential they were given on their first day.")}
${P('This creates a compounding problem:')}
${UL_OPEN}
${LI(`${STRONG('Weak new-hire device security:')} The employee's work laptop isn't yet enrolled in MDM. Their personal email account, which they may have used to forward a work credential, is on a personal device that IT doesn't control.`)}
${LI(`${STRONG('No cleanup on offboarding:')} Offboarding checklists cover account deactivation, device return, and access revocation. They rarely cover "delete the credential email you sent on day one."`)}
${LI(`${STRONG('Archive retention:')} Organizations that retain email archives for legal or compliance purposes may retain these credential emails for years.`)}
${LI(`${STRONG('Account compromise during tenure:')} If the employee's email account is compromised at any point during their time with the company, every credential email they ever received is accessible to the attacker.`)}
${UL_CLOSE}

${HR}

${H2("What's at stake at scale")}
${P("A 50-person engineering team, with an average tenure of two years and standard employee turnover, means roughly 25 onboarding cycles per year. Each cycle produces 10 credential emails. That's 250 credential emails per year sitting in inboxes and sent folders — plus whatever historical archive the organization maintains.")}
${P("The problem is not individual bad actors. It's systemic accumulation of plaintext credentials in email systems that are not designed to hold them.")}

${HR}

${H2('The solution')}
${P('Replace email credential delivery with Torch Secret one-time links.')}
${P('For each credential you need to deliver to a new hire, create a Torch Secret link. Send the link — not the credential — via email or Slack. The new hire opens the link, saves the credential to a password manager, and the record is permanently deleted.')}
${P("The email contains only a link. The credential is not in any inbox. When the employee eventually leaves, there's nothing in their email history to worry about.")}

${HR}

${H2('How to deliver credentials during onboarding (step by step)')}
${OL_OPEN}
${LI(`${STRONG('Separate credentials into individual secrets:')} Don't paste all credentials into a single Torch Secret. Create one secret per credential or per logical group. This gives the new hire a clear record of what they received.`)}
${LI(`${STRONG('Set 24–48 hour expirations:')} Onboarding is chaotic. Give the new hire time to open each link. Remind them to open each one before it expires.`)}
${LI(`${STRONG('Send the links via your onboarding channel:')} Send the Torch Secret links via whatever channel your onboarding process uses — email, Slack, your onboarding platform. The link is not sensitive; only the content behind the link is.`)}
${LI(`${STRONG('Remind the new hire to save credentials to a password manager:')} Each Torch Secret link is single-use. Once it is opened, it is gone. The new hire should save each credential immediately on reveal.`)}
${LI(`${STRONG('Confirm all links have been opened:')} Follow up to confirm the new hire has opened and saved all credentials. If any links expired, generate new ones.`)}
${LI(`${STRONG('Rotate temporary passwords after first login:')} Any temporary password you share should be rotated by the new hire at first login.`)}
${OL_CLOSE}

${HR}

${H2('Why zero-knowledge matters for onboarding')}
${P('Onboarding credential delivery is high-volume and low-attention — it happens in a window when both the IT admin and the new hire are context-switching rapidly. The credential emails often are not cleaned up because nobody tracks them after delivery.')}
${P("Torch Secret's zero-knowledge model means:")}
${UL_OPEN}
${LI("Each credential is encrypted in the IT admin's browser before transmission")}
${LI('The server stores only the encrypted blob')}
${LI("The new hire's browser decrypts it locally when the link is opened")}
${LI('The server record is permanently deleted after one view')}
${LI("Nothing is in the IT admin's sent folder. Nothing is in the new hire's inbox. There is no onboarding email with credentials to clean up at offboarding.")}
${UL_CLOSE}

${HR}

${H2('Who uses Torch Secret for onboarding')}
${UL_OPEN}
${LI(`${STRONG('IT administrators')} delivering initial credentials to new hires — especially at organizations without a centralized secrets management platform`)}
${LI(`${STRONG('Engineering managers')} sharing staging environment credentials with new developers`)}
${LI(`${STRONG('Operations teams')} handling non-technical employee onboarding where shared service credentials need to be distributed`)}
${LI(`${STRONG('Startups')} with small IT teams who handle onboarding manually and need a simple, secure process`)}
${UL_CLOSE}

${HR}

${H2('Frequently asked questions')}
${renderFaq(onboardingFaq)}

${HR}

${P('No account required. Create a link, deliver the credential, move on. Each credential is encrypted in your browser. The server stores only ciphertext. When the link is opened, the record is permanently deleted.')}
${CTA_BUTTON}

${HR}

${H2('Related guides')}
${renderRelated([
  { slug: 'share-database-credentials', label: 'Share Database Credentials Securely' },
  { slug: 'send-password-without-email', label: 'Send a Password Without Email' },
  { slug: 'share-credentials-with-contractor', label: 'Share Credentials with a Contractor' },
])}
`;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export const USE_CASE_PAGES: Record<string, UseCasePageData> = {
  'share-api-keys': {
    meta: {
      title: 'How to Share API Keys Securely — One-Time Encrypted Links',
      canonical: 'https://torchsecret.com/use/share-api-keys',
      metaDesc:
        'API keys shared over Slack or email live forever in message history. Torch Secret encrypts them in your browser and destroys the record after one view.',
      ogTitle: 'How to Share API Keys Securely',
      ogDesc:
        "Paste an API key, get a one-time encrypted link. The key is deleted the moment it's opened. No Slack history, no email archive.",
    },
    h1: 'How to Share API Keys Securely',
    description:
      'Share an API key using a zero-knowledge one-time encrypted link that permanently self-destructs after one view.',
    bodyHtml: buildShareApiKeysBody(),
    steps: shareApiKeysSteps,
    faqItems: shareApiKeysFaq,
  },

  'share-database-credentials': {
    meta: {
      title: 'How to Share Database Credentials Securely — Zero-Knowledge One-Time Links',
      canonical: 'https://torchsecret.com/use/share-database-credentials',
      metaDesc:
        'Database passwords shared over Slack or email persist forever. Torch Secret encrypts credentials in your browser and permanently deletes them after one view.',
      ogTitle: 'How to Share Database Credentials Securely',
      ogDesc:
        "The skeleton key to your data shouldn't live in a Slack message forever. Share it once. Destroy it. Move on.",
    },
    h1: 'How to Share Database Credentials Securely',
    description:
      'Share database credentials using a zero-knowledge one-time link that is permanently deleted after your recipient opens it.',
    bodyHtml: buildShareDbBody(),
    steps: shareDbSteps,
    faqItems: shareDbFaq,
  },

  'share-ssh-keys': {
    meta: {
      title: 'How to Share SSH Keys Without Email or Slack',
      canonical: 'https://torchsecret.com/use/share-ssh-keys',
      metaDesc:
        'SSH private keys shared over email or Slack leave permanent copies in both inboxes. Torch Secret delivers them once and destroys the record immediately.',
      ogTitle: 'How to Share SSH Keys Without Email or Slack',
      ogDesc:
        "An SSH private key in your sent mail is a master key you can't take back. Share it once, destroy it, rotate it.",
    },
    h1: 'How to Share SSH Keys Without Email or Slack',
    description:
      'Deliver SSH private keys as zero-knowledge one-time links that self-destruct immediately after the recipient opens them.',
    bodyHtml: buildShareSshBody(),
    steps: shareSshSteps,
    faqItems: shareSshFaq,
  },

  'send-password-without-email': {
    meta: {
      title: 'How to Send a Password Without Email — One-Time Encrypted Links',
      canonical: 'https://torchsecret.com/use/send-password-without-email',
      metaDesc:
        'Email stores passwords permanently in both inboxes. Torch Secret encrypts the password in your browser and destroys it after one view — no inbox copy, no archive.',
      ogTitle: 'How to Send a Password Without Email',
      ogDesc: 'Email archives are a graveyard of old passwords. There is a better way.',
    },
    h1: 'How to Send a Password Without Email',
    description:
      'Replace the email payload with a one-time encrypted link that permanently destroys itself after the recipient views the password.',
    bodyHtml: buildSendPasswordBody(),
    steps: sendPasswordSteps,
    faqItems: sendPasswordFaq,
  },

  'share-credentials-without-slack': {
    meta: {
      title: 'How to Share Passwords Without Pasting Them in Slack',
      canonical: 'https://torchsecret.com/use/share-credentials-without-slack',
      metaDesc:
        'Slack passwords live in message history forever. Admins can read them. Third-party apps may access them. Torch Secret replaces the paste with a one-time encrypted link.',
      ogTitle: 'How to Share Passwords Without Pasting Them in Slack',
      ogDesc:
        '"I\'ll just Slack it to you." Those credentials are now searchable by every workspace admin, retained in compliance exports, and readable by connected third-party apps.',
    },
    h1: 'How to Share Passwords Without Pasting Them in Slack',
    description:
      'Replace Slack credential pastes with one-time encrypted links — the credential is never in Slack message history.',
    bodyHtml: buildShareWithoutSlackBody(),
    steps: shareWithoutSlackSteps,
    faqItems: shareWithoutSlackFaq,
  },

  'share-env-file': {
    meta: {
      title: 'How to Share a .env File Securely',
      canonical: 'https://torchsecret.com/use/share-env-file',
      metaDesc:
        'A .env file contains every secret in your project at once. Sharing it over Slack or email exposes your database, API keys, and auth secrets simultaneously. Torch Secret encrypts and destroys it after one view.',
      ogTitle: 'How to Share a .env File Securely',
      ogDesc:
        "Your .env file is the crown jewel of your codebase. It should be in .gitignore. It shouldn't be in your sent mail folder.",
    },
    h1: 'How to Share a .env File Securely',
    description:
      'Share .env file contents using a zero-knowledge one-time link that encrypts everything in your browser and destroys the record after one view.',
    bodyHtml: buildShareEnvBody(),
    steps: shareEnvSteps,
    faqItems: shareEnvFaq,
  },

  'share-credentials-with-contractor': {
    meta: {
      title: 'How to Share Credentials with a Contractor Safely',
      canonical: 'https://torchsecret.com/use/share-credentials-with-contractor',
      metaDesc:
        "Contractor credentials shared over email or Slack persist long after the engagement ends. Torch Secret delivers them once and destroys the record — so you're not cleaning up months later.",
      ogTitle: 'How to Share Credentials with a Contractor Safely',
      ogDesc:
        "When the engagement ends, the credentials should too. One-time delivery means there's nothing to chase down later.",
    },
    h1: 'How to Share Credentials with a Contractor Safely',
    description:
      'Deliver contractor credentials via one-time encrypted links that self-destruct after opening, leaving nothing to clean up when the engagement ends.',
    bodyHtml: buildShareContractorBody(),
    steps: shareContractorSteps,
    faqItems: shareContractorFaq,
  },

  'onboarding-credential-handoff': {
    meta: {
      title: 'How to Share Credentials During Employee Onboarding',
      canonical: 'https://torchsecret.com/use/onboarding-credential-handoff',
      metaDesc:
        'IT admins send dozens of credentials to new hires via email on day one. Those emails stay in both inboxes forever. Torch Secret delivers each credential once and destroys it.',
      ogTitle: 'How to Share Credentials During Employee Onboarding',
      ogDesc:
        "Day 1 credentials in a new hire's inbox are still there on day 1,000. Fix the delivery, not the cleanup.",
    },
    h1: 'How to Share Credentials During Employee Onboarding',
    description:
      'Replace onboarding credential emails with one-time encrypted links that are permanently deleted after the new hire opens them.',
    bodyHtml: buildOnboardingBody(),
    steps: onboardingSteps,
    faqItems: onboardingFaq,
  },
};
