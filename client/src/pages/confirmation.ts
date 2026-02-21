/**
 * Confirmation page displayed after successful secret creation.
 *
 * Shows the shareable URL in a prominent card with copy button (toast
 * feedback) and optional native share button (Web Share API progressive
 * enhancement). Includes expiration timestamp and one-time viewing warning.
 *
 * This page is rendered programmatically (state-based, not URL-based) --
 * refreshing the browser returns to the create page since the key is gone
 * from memory.
 *
 * Phase 27: Conversion prompts — for anonymous users, a dismissible branded
 * accent card is rendered after the URL card on the 1st and 3rd secret creation
 * within the same page session (promptNumber 1 or 3). Authenticated users never
 * see prompts. The dismiss button removes the card from the DOM; no localStorage.
 */

import { ShieldCheck } from 'lucide';
import { createIcon } from '../components/icons.js';
import { createCopyButton } from '../components/copy-button.js';
import { createShareButton } from '../components/share-button.js';
import { navigate, updatePageMeta, focusPageHeading } from '../router.js';
import {
  captureConversionPromptShown,
  captureConversionPromptClicked,
} from '../analytics/posthog.js';

/**
 * Create a dismissible branded conversion prompt card for anonymous users.
 *
 * The card features:
 * - A dismiss button (×) that removes the card from the DOM (no localStorage)
 * - A headline and sub-copy describing the account benefit
 * - A 'Sign up — it's free' CTA that navigates to /register and fires PostHog event
 *
 * @param headline - The main headline text (e.g. "Know when your secret is read.")
 * @param subCopy - The supporting copy below the headline
 * @param promptNumber - 1 or 3, used for PostHog event tracking
 */
function createConversionPromptCard(
  headline: string,
  subCopy: string,
  promptNumber: 1 | 3,
): HTMLElement {
  const card = document.createElement('div');
  card.className =
    'relative p-4 rounded-lg border border-accent/30 bg-accent/5 backdrop-blur-md shadow-sm text-left';

  // Dismiss button (×) — removes card from DOM, no localStorage
  const dismissBtn = document.createElement('button');
  dismissBtn.type = 'button';
  dismissBtn.setAttribute('aria-label', 'Dismiss signup prompt');
  dismissBtn.className =
    'absolute top-2 right-2 p-1 text-text-muted hover:text-text-primary rounded focus:ring-2 focus:ring-accent focus:outline-hidden transition-colors cursor-pointer';
  dismissBtn.textContent = '\u00d7'; // × character via Unicode escape (textContent only, never innerHTML)
  dismissBtn.addEventListener('click', () => card.remove());

  const headlineEl = document.createElement('p');
  headlineEl.className = 'font-semibold text-text-primary text-sm pr-6';
  headlineEl.textContent = headline;

  const subEl = document.createElement('p');
  subEl.className = 'text-xs text-text-secondary mt-1';
  subEl.textContent = subCopy;

  const ctaLink = document.createElement('a');
  ctaLink.href = '/register';
  ctaLink.className =
    'mt-3 inline-block min-h-[36px] px-4 py-1.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-hover focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden transition-all cursor-pointer';
  ctaLink.textContent = "Sign up \u2014 it's free";
  ctaLink.addEventListener('click', (e) => {
    e.preventDefault();
    captureConversionPromptClicked(promptNumber);
    navigate('/register');
  });

  card.appendChild(dismissBtn);
  card.appendChild(headlineEl);
  card.appendChild(subEl);
  card.appendChild(ctaLink);
  return card;
}

/**
 * Render the confirmation page after successful secret creation.
 *
 * Replaces the container content with the share URL in a prominent card,
 * copy button with toast feedback, conditional native share button,
 * expiration info, one-time-view warning, and "Create Another" button.
 *
 * When a passphrase is provided (Phase 24), an additional passphrase card
 * and two-channel security guidance block are rendered below the URL card.
 *
 * When promptNumber is 1 or 3 (Phase 27), a dismissible conversion prompt card
 * is rendered below the URL card for anonymous users. Authenticated users pass
 * null or undefined for promptNumber and never see prompts.
 *
 * @param container - The DOM element to render into
 * @param shareUrl - The full shareable URL including the encryption key fragment
 * @param expiresAt - ISO 8601 timestamp string for when the secret expires
 * @param label - Optional label set by the authenticated user during creation
 * @param passphrase - Optional EFF diceware passphrase for two-channel delivery (Phase 24)
 * @param promptNumber - 1 or 3 for conversion prompts; null/undefined for no prompt (Phase 27)
 */
export function renderConfirmationPage(
  container: HTMLElement,
  shareUrl: string,
  expiresAt: string,
  label?: string,
  passphrase?: string,
  promptNumber?: 1 | 3 | null,
): void {
  // Update page title and announce to screen readers
  updatePageMeta({
    title: 'Your Secure Link is Ready',
    description:
      'Share secrets securely with zero-knowledge encryption. One-time view, no accounts, end-to-end encrypted in your browser.',
  });

  // Clear existing content
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  // -- Page wrapper --
  const wrapper = document.createElement('div');
  wrapper.className = 'space-y-6 text-center';

  // -- Success icon (Lucide ShieldCheck via shared icon system) --
  const iconContainer = document.createElement('div');
  iconContainer.className = 'flex justify-center';

  const iconBg = document.createElement('div');
  iconBg.className = 'w-16 h-16 rounded-full bg-success/10 flex items-center justify-center';

  const icon = createIcon(ShieldCheck, { size: 48, class: 'text-success' });
  iconBg.appendChild(icon);
  iconContainer.appendChild(iconBg);
  wrapper.appendChild(iconContainer);

  // -- Heading --
  const heading = document.createElement('h1');
  heading.className = 'text-2xl sm:text-3xl font-heading font-semibold text-text-primary';
  heading.textContent = 'Your Secure Link is Ready';
  wrapper.appendChild(heading);

  // -- Share URL card (primary visual element) --
  const urlCard = document.createElement('div');
  urlCard.className =
    'p-6 rounded-lg border border-border bg-surface/80 backdrop-blur-md shadow-lg space-y-4 text-left';

  // URL label
  const urlLabel = document.createElement('span');
  urlLabel.className = 'block text-sm text-text-muted mb-2';
  urlLabel.textContent = 'Share this link with your recipient:';
  urlCard.appendChild(urlLabel);

  // URL display (monospace code block, full URL visible with break-all)
  const urlDisplay = document.createElement('div');
  urlDisplay.className =
    'w-full px-3 py-3 rounded-lg bg-surface-raised text-text-secondary text-sm font-mono break-all select-all';

  const urlCode = document.createElement('code');
  urlCode.textContent = shareUrl; // NEVER innerHTML
  urlDisplay.appendChild(urlCode);
  urlCard.appendChild(urlDisplay);

  // Button row: copy (primary) + share (secondary, conditional)
  const buttonRow = document.createElement('div');
  buttonRow.className = 'flex items-center gap-3 mt-3';

  const copyButton = createCopyButton(() => shareUrl, 'Copy Link');
  copyButton.classList.remove('transition-colors');
  copyButton.classList.add(
    'transition-all',
    'motion-safe:hover:scale-[1.02]',
    'motion-safe:active:scale-[0.98]',
  );
  buttonRow.appendChild(copyButton);

  const shareBtn = createShareButton(shareUrl, 'SecureShare - Your secure link');
  if (shareBtn) {
    buttonRow.appendChild(shareBtn);
  }

  urlCard.appendChild(buttonRow);
  wrapper.appendChild(urlCard);

  // -- Conversion prompt for anonymous users (CONV-04, CONV-05) --
  // promptNumber 1 = after first creation, 3 = after third creation.
  // Authenticated users pass null/undefined — no prompt rendered.
  if (promptNumber === 1) {
    const prompt = createConversionPromptCard(
      'Know when your secret is read.',
      'Get a read receipt by email \u2014 free with an account.',
      1,
    );
    wrapper.appendChild(prompt);
    captureConversionPromptShown(1);
  } else if (promptNumber === 3) {
    const prompt = createConversionPromptCard(
      'Your secrets, tracked.',
      'A dashboard that shows you what\u2019s active, what\u2019s been opened, and what\u2019s expired.',
      3,
    );
    wrapper.appendChild(prompt);
    captureConversionPromptShown(3);
  }

  // -- Passphrase card (Phase 24 — only rendered when passphrase is provided) --
  if (passphrase) {
    const passphraseCard = document.createElement('div');
    passphraseCard.className =
      'p-6 rounded-lg border border-border bg-surface/80 backdrop-blur-md shadow-lg space-y-4 text-left';

    const passphraseLabel = document.createElement('span');
    passphraseLabel.className = 'block text-sm text-text-muted mb-2';
    passphraseLabel.textContent = 'Share this passphrase separately:';
    passphraseCard.appendChild(passphraseLabel);

    const passphraseDisplay = document.createElement('div');
    passphraseDisplay.className =
      'w-full px-3 py-3 rounded-lg bg-surface-raised text-text-secondary text-sm font-mono select-all';
    const code = document.createElement('code');
    code.textContent = passphrase; // NEVER innerHTML
    passphraseDisplay.appendChild(code);
    passphraseCard.appendChild(passphraseDisplay);

    const copyPassphraseBtn = createCopyButton(() => passphrase, 'Copy Passphrase');
    copyPassphraseBtn.classList.remove('transition-colors');
    copyPassphraseBtn.classList.add(
      'transition-all',
      'motion-safe:hover:scale-[1.02]',
      'motion-safe:active:scale-[0.98]',
    );
    passphraseCard.appendChild(copyPassphraseBtn);

    wrapper.appendChild(passphraseCard);
  }

  // -- Two-channel security guidance (Phase 24 — only rendered when passphrase is provided) --
  if (passphrase) {
    const guidance = document.createElement('div');
    guidance.className =
      'px-4 py-3 rounded-lg bg-surface/80 border border-border text-sm text-text-secondary space-y-1 text-left';

    const guidanceHeading = document.createElement('p');
    guidanceHeading.className = 'font-semibold text-text-primary';
    guidanceHeading.textContent = 'Two-channel security';

    const guidanceBody = document.createElement('p');
    guidanceBody.textContent =
      'For maximum security, share the link and passphrase through separate channels — ' +
      'for example, send the link by email and the passphrase by text message.';

    guidance.appendChild(guidanceHeading);
    guidance.appendChild(guidanceBody);
    wrapper.appendChild(guidance);
  }

  // -- Expiration notice --
  const expiresDate = new Date(expiresAt);
  const expirationNotice = document.createElement('p');
  expirationNotice.className = 'text-sm text-text-muted';
  expirationNotice.textContent = `This link expires on ${expiresDate.toLocaleString()}`;
  wrapper.appendChild(expirationNotice);

  // -- Label (only visible to the authenticated creator, shown for reference) --
  if (label) {
    const labelEl = document.createElement('p');
    labelEl.className = 'text-sm text-text-muted';
    labelEl.textContent = `Label: ${label}`;
    wrapper.appendChild(labelEl);
  }

  // -- Warning text --
  const warning = document.createElement('div');
  warning.className = 'px-4 py-3 rounded-lg bg-accent/10 backdrop-blur-sm text-accent text-sm';
  warning.textContent =
    'This link can only be viewed once. Once opened, the secret is permanently destroyed.';
  wrapper.appendChild(warning);

  // -- Create another button --
  const createAnotherButton = document.createElement('button');
  createAnotherButton.type = 'button';
  createAnotherButton.className =
    'inline-block min-h-[44px] py-2 text-accent hover:text-accent-hover focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden rounded font-medium transition-all cursor-pointer motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98]';
  createAnotherButton.textContent = 'Create Another Secret';
  createAnotherButton.addEventListener('click', () => {
    navigate('/');
  });
  wrapper.appendChild(createAnotherButton);

  container.appendChild(wrapper);

  // Move focus to heading for screen reader users
  focusPageHeading();
}
