/**
 * Terms of Service page.
 *
 * Renders a full Terms of Service describing acceptable use, service
 * limitations, the zero-knowledge model, and legal disclaimers.
 * Uses createElement/textContent only — no innerHTML.
 *
 * Satisfies LEGAL-02: /terms route with noindex meta.
 */

/**
 * Render the Terms of Service page into the given container.
 *
 * @param container - The DOM element to render into
 */
export function renderTermsPage(container: HTMLElement): void {
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
  h1.textContent = 'Terms of Service';
  card.appendChild(h1);

  // Subtitle / last-updated date
  const subtitle = document.createElement('p');
  subtitle.className = 'text-text-muted text-sm';
  subtitle.textContent = 'Last updated: February 2026';
  card.appendChild(subtitle);

  // Section data
  const sections: Array<{ heading: string; paragraphs: string[] }> = [
    {
      heading: 'Acceptance of Terms',
      paragraphs: [
        'By using SecureShare, you agree to these Terms of Service. If you do not agree, do not use the service.',
      ],
    },
    {
      heading: 'What the Service Does',
      paragraphs: [
        'SecureShare is a zero-knowledge, one-time secret sharing service. You encrypt sensitive text in your browser; we store only the encrypted result. The secret is permanently destroyed from our database the moment it is viewed.',
      ],
    },
    {
      heading: 'Acceptable Use',
      paragraphs: [
        'You may use SecureShare only for lawful purposes. You must not use the service to:',
        '(a) Share content that violates applicable laws.',
        '(b) Harass, threaten, or harm others.',
        '(c) Distribute malware or phishing content.',
        '(d) Attempt to reverse-engineer the encryption or circumvent rate limits.',
        '(e) Use automated scripts to create secrets in bulk.',
        'We reserve the right to terminate accounts or block IP addresses that violate these terms.',
      ],
    },
    {
      heading: 'Prohibited Content',
      paragraphs: [
        'You are solely responsible for the content you share. Because SecureShare is zero-knowledge, we cannot inspect content. By using the service, you warrant that you will not share illegal content.',
        '[Company Name] is not liable for content shared by users.',
      ],
    },
    {
      heading: 'Account Responsibilities',
      paragraphs: [
        'Provide accurate information when registering. Keep your password secure. Notify us immediately at [Contact Email] if you suspect unauthorized access to your account.',
      ],
    },
    {
      heading: 'Service Limitations',
      paragraphs: [
        'Secrets are permanently destroyed on first view. We cannot recover a secret after it has been viewed or expired.',
        'We do not guarantee delivery: if a secret expires before the recipient opens it, the content is permanently lost.',
        'The service is provided "as is" without uptime guarantees.',
      ],
    },
    {
      heading: 'Zero-Knowledge Model and Law Enforcement',
      paragraphs: [
        'We are technically unable to access secret content. Law enforcement requests for the content of secrets cannot be fulfilled because we do not possess the encryption keys.',
        'We may disclose account metadata (name, email, IP logs if retained) in response to valid legal process.',
      ],
    },
    {
      heading: 'Intellectual Property',
      paragraphs: [
        'The SecureShare software and brand are owned by [Company Name]. These Terms do not grant you any rights in our intellectual property.',
      ],
    },
    {
      heading: 'Disclaimer of Warranties',
      paragraphs: [
        'THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. [Company Name] DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.',
      ],
    },
    {
      heading: 'Limitation of Liability',
      paragraphs: [
        'TO THE MAXIMUM EXTENT PERMITTED BY LAW, [Company Name] IS NOT LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES ARISING FROM YOUR USE OF THE SERVICE.',
      ],
    },
    {
      heading: 'Governing Law',
      paragraphs: [
        'These terms are governed by the laws of [Jurisdiction]. Disputes shall be resolved in the courts of [Jurisdiction].',
      ],
    },
    {
      heading: 'Contact',
      paragraphs: ['Questions? Contact us at [Contact Email].'],
    },
  ];

  for (const { heading, paragraphs } of sections) {
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
