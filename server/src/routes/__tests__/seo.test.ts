import { describe, test, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { buildApp } from '../../app.js';
import { pool } from '../../db/connection.js';

let app: Express;
beforeEach(() => {
  app = buildApp();
});
afterAll(async () => {
  await pool.end();
});

// SEO-01: Competitor comparison pages (/vs/*)
describe('SEO-01: VS pages server-rendered', () => {
  test.each(['onetimesecret', 'pwpush', 'privnote'])(
    'GET /vs/%s returns 200 with <h1> in body',
    async (slug) => {
      const res = await request(app).get(`/vs/${slug}`).expect(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.text).toMatch(/<h1/);
      // must NOT be the SPA shell (which has __CSP_NONCE__ placeholder)
      expect(res.text).not.toContain('__CSP_NONCE__');
    },
  );

  test('GET /vs/unknown-slug returns 404', async () => {
    await request(app).get('/vs/unknown-competitor-xyz').expect(404);
  });
});

// SEO-02: Alternatives pages (/alternatives/*)
describe('SEO-02: Alternatives pages server-rendered', () => {
  test.each(['onetimesecret', 'pwpush', 'privnote'])(
    'GET /alternatives/%s returns 200 with <h1> in body',
    async (slug) => {
      const res = await request(app).get(`/alternatives/${slug}`).expect(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.text).toMatch(/<h1/);
      expect(res.text).not.toContain('__CSP_NONCE__');
    },
  );

  test('GET /alternatives/unknown-slug returns 404', async () => {
    await request(app).get('/alternatives/unknown-competitor-xyz').expect(404);
  });
});

// SEO-03: Use-case hub page (/use/)
describe('SEO-03: Use-case hub page server-rendered', () => {
  test('GET /use/ returns 200 with <h1> and links to all 8 use-case slugs', async () => {
    const res = await request(app).get('/use/').expect(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toMatch(/<h1/);
    expect(res.text).not.toContain('__CSP_NONCE__');
    // hub must link to all 8 slug pages
    const slugs = [
      'share-api-keys',
      'share-database-credentials',
      'share-ssh-keys',
      'send-password-without-email',
      'share-credentials-without-slack',
      'share-env-file',
      'share-credentials-with-contractor',
      'onboarding-credential-handoff',
    ];
    for (const slug of slugs) {
      expect(res.text).toContain(`/use/${slug}`);
    }
  });
});

// SEO-04: Individual use-case pages (/use/:slug)
describe('SEO-04: Individual use-case pages server-rendered', () => {
  const USE_CASE_SLUGS = [
    'share-api-keys',
    'share-database-credentials',
    'share-ssh-keys',
    'send-password-without-email',
    'share-credentials-without-slack',
    'share-env-file',
    'share-credentials-with-contractor',
    'onboarding-credential-handoff',
  ];

  test.each(USE_CASE_SLUGS)('GET /use/%s returns 200 with <h1> in body', async (slug) => {
    const res = await request(app).get(`/use/${slug}`).expect(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toMatch(/<h1/);
    expect(res.text).not.toContain('__CSP_NONCE__');
  });

  test('GET /use/unknown-slug returns 404', async () => {
    await request(app).get('/use/unknown-slug-xyz').expect(404);
  });
});

// SEO-05: JSON-LD structured data
describe('SEO-05: JSON-LD in <head>', () => {
  test('GET /vs/onetimesecret includes FAQPage JSON-LD', async () => {
    const res = await request(app).get('/vs/onetimesecret').expect(200);
    expect(res.text).toContain('"@type":"FAQPage"');
  });

  test('GET /vs/pwpush includes FAQPage JSON-LD', async () => {
    const res = await request(app).get('/vs/pwpush').expect(200);
    expect(res.text).toContain('"@type":"FAQPage"');
  });

  test('GET /alternatives/onetimesecret includes FAQPage JSON-LD', async () => {
    const res = await request(app).get('/alternatives/onetimesecret').expect(200);
    expect(res.text).toContain('"@type":"FAQPage"');
  });

  test('GET /use/share-api-keys includes HowTo JSON-LD', async () => {
    const res = await request(app).get('/use/share-api-keys').expect(200);
    expect(res.text).toContain('"@type":"HowTo"');
  });

  test('GET /use/send-password-without-email includes FAQPage JSON-LD', async () => {
    const res = await request(app).get('/use/send-password-without-email').expect(200);
    expect(res.text).toContain('"@type":"FAQPage"');
  });
});

// SEO-06: No X-Robots-Tag noindex + sitemap coverage
describe('SEO-06: SEO pages are indexable', () => {
  test.each([
    '/vs/onetimesecret',
    '/vs/pwpush',
    '/vs/privnote',
    '/alternatives/onetimesecret',
    '/alternatives/pwpush',
    '/alternatives/privnote',
    '/use/',
    '/use/share-api-keys',
  ])('GET %s does not have X-Robots-Tag: noindex header', async (path) => {
    const res = await request(app).get(path).expect(200);
    const robotsHeader = res.headers['x-robots-tag'] as string | undefined;
    // No noindex header expected on SEO pages
    if (robotsHeader) {
      expect(robotsHeader).not.toContain('noindex');
    }
  });
});
