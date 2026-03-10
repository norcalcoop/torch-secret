import { describe, it, expect } from 'vitest';
import { VS_PAGES } from '../../routes/seo/templates/vs-pages.js';

describe('VS_PAGES — new comparison page entries', () => {
  describe('bitwarden-send', () => {
    it('entry exists in VS_PAGES', () => {
      expect(VS_PAGES['bitwarden-send']).toBeDefined();
    });

    it('meta.title contains "Bitwarden Send"', () => {
      expect(VS_PAGES['bitwarden-send']?.meta.title).toContain('Bitwarden Send');
    });

    it('meta.canonical equals https://torchsecret.com/vs/bitwarden-send', () => {
      expect(VS_PAGES['bitwarden-send']?.meta.canonical).toBe(
        'https://torchsecret.com/vs/bitwarden-send',
      );
    });

    it('bodyHtml contains "Bitwarden Send" (case-insensitive)', () => {
      expect(VS_PAGES['bitwarden-send']?.bodyHtml.toLowerCase()).toContain('bitwarden send');
    });

    it('faqItems has at least 1 item', () => {
      expect(VS_PAGES['bitwarden-send']?.faqItems.length).toBeGreaterThanOrEqual(1);
    });

    it('faqItems[0].question is a non-empty string', () => {
      const question = VS_PAGES['bitwarden-send']?.faqItems[0]?.question;
      expect(question).toBeTruthy();
      expect(typeof question).toBe('string');
    });
  });

  describe('email-and-slack', () => {
    it('entry exists in VS_PAGES', () => {
      expect(VS_PAGES['email-and-slack']).toBeDefined();
    });

    it('meta.title contains "Email" or "Slack"', () => {
      const title = VS_PAGES['email-and-slack']?.meta.title ?? '';
      expect(title.includes('Email') || title.includes('Slack')).toBe(true);
    });

    it('meta.canonical equals https://torchsecret.com/vs/email-and-slack', () => {
      expect(VS_PAGES['email-and-slack']?.meta.canonical).toBe(
        'https://torchsecret.com/vs/email-and-slack',
      );
    });

    it('bodyHtml has substantive content (> 200 chars)', () => {
      expect(VS_PAGES['email-and-slack']?.bodyHtml.length).toBeGreaterThan(200);
    });

    it('faqItems has at least 1 item', () => {
      expect(VS_PAGES['email-and-slack']?.faqItems.length).toBeGreaterThanOrEqual(1);
    });

    it('faqItems[0].question is a non-empty string', () => {
      const question = VS_PAGES['email-and-slack']?.faqItems[0]?.question;
      expect(question).toBeTruthy();
      expect(typeof question).toBe('string');
    });
  });
});
