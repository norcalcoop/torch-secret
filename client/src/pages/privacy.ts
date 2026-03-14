/**
 * Privacy Policy page.
 *
 * Renders a full Privacy Policy describing the Torch Secret zero-knowledge
 * architecture in plain English. Uses createElement/textContent only — no innerHTML.
 *
 * Satisfies LEGAL-01: /privacy route with noindex meta.
 */

/**
 * Render the Privacy Policy page into the given container.
 *
 * @param container - The DOM element to render into
 */
export function renderPrivacyPage(container: HTMLElement): void {
  // Outer wrapper: prose container
  const wrapper = document.createElement('div');
  wrapper.className = 'max-w-2xl mx-auto space-y-8';

  // Glassmorphism card
  const card = document.createElement('div');
  card.className =
    'p-6 sm:p-8 rounded-lg border border-border bg-surface/80 backdrop-blur-md shadow-lg';

  // Page heading
  const h1 = document.createElement('h1');
  h1.className = 'text-2xl sm:text-3xl font-heading font-semibold text-text-primary';
  h1.textContent = 'Privacy Policy';
  card.appendChild(h1);

  // Subtitle / last-updated date
  const subtitle = document.createElement('p');
  subtitle.className = 'text-text-muted text-sm';
  subtitle.textContent = 'Last updated: February 2026';
  card.appendChild(subtitle);

  // Section data
  const sections: Array<{ heading: string; paragraphs: string[] }> = [
    {
      heading: 'Who We Are',
      paragraphs: [
        'Torch Secret operates a zero-knowledge one-time secret sharing service. Contact us at contact@torchsecret.com.',
      ],
    },
    {
      heading: 'What We Collect',
      paragraphs: [
        'Anonymous users: encrypted ciphertext blobs (we cannot decrypt them), expiration metadata, and your IP address for rate limiting (not permanently logged). No tracking cookies are used for anonymous usage.',
        'Authenticated users: your name, email address, a hashed version of your password (Argon2id — we never store your actual password), session tokens, and metadata about secrets you create (label, creation date, expiry, status, notification setting). We never store secret content — only the encrypted blob we cannot read.',
      ],
    },
    {
      heading: 'What We Never Collect',
      paragraphs: [
        'We never see your secret content. Secrets are encrypted in your browser using AES-256-GCM before being sent to our servers. The encryption key lives only in the URL fragment (#key), which is never transmitted to our servers per RFC 3986.',
        'We cannot read your secrets even if compelled to. The encryption key is never in our possession.',
      ],
    },
    {
      heading: 'How We Use Data',
      paragraphs: [
        'We use collected data for: secret delivery and automatic destruction after one view; user authentication and session management; rate limiting to prevent abuse; and sending optional notification emails (per-secret opt-in, available to Pro subscribers).',
      ],
    },
    {
      heading: 'Data Retention',
      paragraphs: [
        'Anonymous secrets: automatically deleted from our database the moment they are viewed, or when they expire (whichever comes first).',
        'Account data: retained while your account is active. You may delete your account at any time by contacting contact@torchsecret.com, which permanently deletes all associated metadata.',
      ],
    },
    {
      heading: 'Third-Party Services',
      paragraphs: [
        'We use the following third-party services:',
        '(a) A cloud hosting provider to run our servers.',
        '(b) Resend for transactional email delivery. Notification emails are sent only to opted-in authenticated users. Email addresses are transmitted to Resend only when sending an email.',
        '(c) PostHog for privacy-safe product analytics. PostHog is configured with autocapture disabled, session recording disabled, and URL fragment stripping to prevent encryption key leakage.',
        'We do not use Google Analytics or any advertising network.',
      ],
    },
    {
      heading: 'Cookies',
      paragraphs: [
        'We use session cookies only for authenticated users (necessary for login). We do not use tracking cookies, advertising cookies, or third-party analytics cookies.',
      ],
    },
    {
      heading: 'Your Rights',
      paragraphs: [
        'You may request access to, correction of, or deletion of your personal data by contacting contact@torchsecret.com. Anonymous usage generates no personal data on our end.',
      ],
    },
    {
      heading: 'Changes to This Policy',
      paragraphs: [
        'We will post changes to this page with an updated date. Continued use of the service constitutes acceptance of the revised policy.',
      ],
    },
    {
      heading: 'Contact',
      paragraphs: ['Questions or requests? Contact us at contact@torchsecret.com.'],
    },
  ];

  for (const { heading, paragraphs } of sections) {
    if (heading === 'Your Rights') {
      // Rendered manually to produce a clickable mailto link.
      // Using createElement/appendChild only — no innerHTML (CSP + XSS hygiene).
      const rightsSection = document.createElement('section');

      const rightsH2 = document.createElement('h2');
      rightsH2.className = 'text-xl font-heading font-semibold text-text-primary mt-6 mb-2';
      rightsH2.textContent = 'Your Rights';
      rightsSection.appendChild(rightsH2);

      const rightsP = document.createElement('p');
      rightsP.className = 'text-text-secondary leading-relaxed';
      rightsP.appendChild(
        document.createTextNode(
          'You may request access to, correction of, or deletion of your personal data by contacting ',
        ),
      );
      const privacyLink = document.createElement('a');
      privacyLink.href = 'mailto:privacy@torchsecret.com';
      privacyLink.textContent = 'privacy@torchsecret.com';
      privacyLink.className = 'underline hover:text-text-primary transition-colors';
      rightsP.appendChild(privacyLink);
      rightsP.appendChild(
        document.createTextNode('. Anonymous usage generates no personal data on our end.'),
      );
      rightsSection.appendChild(rightsP);
      card.appendChild(rightsSection);
      continue;
    }

    const section = document.createElement('section');

    const h2 = document.createElement('h2');
    h2.className = 'text-xl font-heading font-semibold text-text-primary mt-6 mb-2';
    h2.textContent = heading;
    section.appendChild(h2);

    for (const text of paragraphs) {
      const p = document.createElement('p');
      p.className = 'text-text-secondary leading-relaxed';
      p.textContent = text;
      section.appendChild(p);
    }

    card.appendChild(section);
  }

  wrapper.appendChild(card);
  container.appendChild(wrapper);
}
