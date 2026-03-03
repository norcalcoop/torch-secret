/**
 * Pricing page module.
 *
 * Five sections rendered in order:
 *   1. Page header — h1 headline + subheading
 *   2. Billing toggle — monthly/annual pill switch (annual default, 22% savings badge)
 *   3. Tier cards — Free + Pro side-by-side comparison cards
 *   4. Trust strip — Cancel any time / No contracts / Powered by Stripe
 *   5. FAQ accordion — 6 native <details>/<summary> accordion items
 *
 * The FAQ_ITEMS array is exported so Plan 02 can verify JSON-LD parity
 * between this file and the FAQPage block added to client/index.html.
 *
 * Follows the vanilla TS DOM-construction pattern used throughout the codebase.
 * No innerHTML. No third-party UI frameworks. Semantic design tokens throughout.
 */

import { Check, Minus, ChevronDown } from 'lucide';
import { createIcon } from '../components/icons.js';
import { navigate } from '../router.js';

// ---------------------------------------------------------------------------
// Canonical FAQ data — exported for Plan 02 JSON-LD parity check
// ---------------------------------------------------------------------------

/**
 * Canonical FAQ items array.
 *
 * IMPORTANT: The text values here must match the FAQPage JSON-LD block in
 * client/index.html exactly (Plan 02 responsibility). Do not change these
 * strings without also updating the JSON-LD block.
 */
export const FAQ_ITEMS: Array<{ question: string; answer: string }> = [
  {
    question: 'Can I cancel my Pro subscription at any time?',
    answer:
      'Yes. Cancel anytime from your billing settings. Your Pro access continues until the end of the current billing period — no partial refunds for unused time.',
  },
  {
    question: 'What is your refund policy?',
    answer:
      'We offer a 7-day money-back guarantee on your first payment. After that, payments are non-refundable, but you can cancel before the next billing date to avoid future charges.',
  },
  {
    question: 'Is there a free trial for Pro?',
    answer:
      "There's no time-limited trial. The Free tier is the trial — use it as long as you like with no credit card required. Upgrade to Pro when you need 30-day expiration or the secret dashboard.",
  },
  {
    question: 'How does billing work?',
    answer:
      'Monthly billing charges your card on the same date each month. Annual billing charges once per year at $65 (about $5.42/month). You can switch billing periods from your account settings.',
  },
  {
    question: 'What payment methods do you accept?',
    answer:
      'We accept all major credit and debit cards (Visa, Mastercard, American Express, Discover) via Stripe. Apple Pay and Google Pay are available on supported devices.',
  },
  {
    question: 'Does Torch Secret see my secret content?',
    answer:
      'No. Secrets are encrypted in your browser using AES-256-GCM before being sent to our servers. The encryption key lives only in the URL fragment and is never transmitted to us — we cannot read your secrets even if compelled to.',
  },
];

// ---------------------------------------------------------------------------
// Feature list data
// ---------------------------------------------------------------------------

const FREE_FEATURES: Array<{ text: string; included: boolean }> = [
  { text: 'One-time encrypted secrets', included: true },
  { text: 'Up to 7-day expiration', included: true },
  { text: 'Password protection', included: true },
  { text: 'Anonymous — no account required', included: true },
  { text: '30-day expiration', included: false },
  { text: 'Secret dashboard & history', included: false },
];

const PRO_FEATURES: Array<{ text: string; included: boolean }> = [
  { text: 'Unlimited secrets', included: true },
  { text: 'Up to 30-day expiration', included: true },
  { text: 'Password protection', included: true },
  { text: 'Secret dashboard & history', included: true },
  { text: 'Email notification on view', included: true },
  { text: 'Priority support', included: true },
];

// ---------------------------------------------------------------------------
// Page entry point
// ---------------------------------------------------------------------------

/**
 * Render the pricing page into the given container.
 *
 * @param container - The #app container element from the router
 */
export function renderPricingPage(container: HTMLElement): void {
  const wrapper = document.createElement('div');
  wrapper.className = 'space-y-12 pb-20 sm:pb-8';

  wrapper.appendChild(createPageHeader());

  const { element: toggleEl, updatePriceLabels } = createBillingToggle();
  wrapper.appendChild(toggleEl);

  wrapper.appendChild(createTierCards(updatePriceLabels));
  wrapper.appendChild(createTrustStrip());
  wrapper.appendChild(createFaqSection());

  container.appendChild(wrapper);
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

/**
 * Page header: h1 headline and subheading.
 */
function createPageHeader(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'py-10 sm:py-14 text-center space-y-4';

  const heading = document.createElement('h1');
  heading.className =
    'text-3xl sm:text-4xl font-heading font-semibold text-text-primary leading-tight';
  heading.textContent = 'Simple, transparent pricing';
  section.appendChild(heading);

  const subhead = document.createElement('p');
  subhead.className = 'text-lg text-text-secondary max-w-md mx-auto';
  subhead.textContent = 'Start for free. Upgrade when you need more.';
  section.appendChild(subhead);

  return section;
}

/**
 * Billing toggle: monthly/annual pill switch with savings badge.
 *
 * Returns the wrapper element and an `updatePriceLabels` callback. The caller
 * (renderPricingPage) passes `updatePriceLabels` to createTierCards, which
 * registers the Pro card's actual price-update function so the toggle can
 * drive textContent changes without direct coupling.
 */
function createBillingToggle(): {
  element: HTMLElement;
  updatePriceLabels: (fn: (isAnnual: boolean) => void) => void;
} {
  let isAnnual = true; // default: annual

  // Slot for the Pro card price updater — filled by createTierCards
  let priceUpdater: (isAnnual: boolean) => void = () => undefined;

  const wrapper = document.createElement('div');
  wrapper.className = 'flex items-center justify-center gap-3 flex-wrap';

  // Monthly label
  const monthlyLabel = document.createElement('span');
  monthlyLabel.className = 'text-sm text-text-secondary';
  monthlyLabel.textContent = 'Monthly';
  wrapper.appendChild(monthlyLabel);

  // Toggle button styled as a pill switch
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.setAttribute('role', 'switch');
  toggle.setAttribute('aria-checked', 'true');
  toggle.setAttribute('aria-label', 'Toggle billing period');
  toggle.className =
    'relative inline-flex h-6 w-11 items-center rounded-full bg-accent transition-colors ' +
    'focus:outline-hidden focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg ' +
    'cursor-pointer';

  const thumb = document.createElement('span');
  // translate-x-6 = annual (right position)
  thumb.className =
    'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform translate-x-6';
  toggle.appendChild(thumb);
  wrapper.appendChild(toggle);

  // Annual label
  const annualLabel = document.createElement('span');
  annualLabel.className = 'text-sm font-medium text-text-primary';
  annualLabel.textContent = 'Annual';
  wrapper.appendChild(annualLabel);

  // Savings badge — visible when annual is selected (initial state)
  const savingsBadge = document.createElement('span');
  savingsBadge.className =
    'text-xs font-medium px-1.5 py-0.5 rounded-full bg-success/10 text-success';
  savingsBadge.textContent = '22% savings';
  wrapper.appendChild(savingsBadge);

  // Toggle click handler
  toggle.addEventListener('click', () => {
    isAnnual = !isAnnual;
    toggle.setAttribute('aria-checked', isAnnual ? 'true' : 'false');
    // Thumb: translate-x-6 = right (annual), translate-x-1 = left (monthly)
    thumb.classList.toggle('translate-x-6', isAnnual);
    thumb.classList.toggle('translate-x-1', !isAnnual);
    // Show savings badge only when annual is active
    savingsBadge.classList.toggle('invisible', !isAnnual);
    priceUpdater(isAnnual);
  });

  return {
    element: wrapper,
    // Registration function: tier cards call this to wire the Pro card price updater
    updatePriceLabels: (fn: (isAnnual: boolean) => void) => {
      priceUpdater = fn;
    },
  };
}

/**
 * Tier cards grid: Free and Pro side-by-side.
 *
 * @param updatePriceLabels - Registration function from createBillingToggle.
 *   Receives the Pro card's price updater so the toggle can call it on change.
 */
function createTierCards(
  updatePriceLabels: (fn: (isAnnual: boolean) => void) => void,
): HTMLElement {
  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-1 sm:grid-cols-2 gap-6';

  grid.appendChild(createFreeCard());

  const { element: proCard, updatePrice } = createProCard();
  grid.appendChild(proCard);

  // Register the Pro card price updater with the billing toggle
  updatePriceLabels(updatePrice);

  return grid;
}

/**
 * Free tier card.
 */
function createFreeCard(): HTMLElement {
  const card = document.createElement('div');
  card.className =
    'relative p-6 rounded-xl border border-border bg-surface/80 backdrop-blur-md flex flex-col gap-4';

  // Tier name
  const tierName = document.createElement('h2');
  tierName.className = 'text-xl font-heading font-semibold text-text-primary';
  tierName.textContent = 'Free';
  card.appendChild(tierName);

  // Price display
  const priceDiv = document.createElement('div');
  const priceAmount = document.createElement('span');
  priceAmount.className = 'text-4xl font-bold font-heading text-text-primary';
  priceAmount.textContent = '$0';
  const pricePeriod = document.createElement('span');
  pricePeriod.className = 'text-sm text-text-muted ml-1';
  pricePeriod.textContent = '/forever';
  priceDiv.appendChild(priceAmount);
  priceDiv.appendChild(pricePeriod);
  card.appendChild(priceDiv);

  // Feature list
  card.appendChild(createFeatureList(FREE_FEATURES));

  // CTA
  const cta = document.createElement('a');
  cta.href = '/create';
  cta.className =
    'mt-auto block text-center px-6 py-3 min-h-[44px] rounded-lg border border-border bg-surface ' +
    'text-text-primary font-semibold hover:bg-surface/60 focus:ring-2 focus:ring-accent ' +
    'focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden transition-all cursor-pointer';
  cta.textContent = 'Start for free';
  cta.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/create');
  });
  card.appendChild(cta);

  return card;
}

/**
 * Pro tier card.
 *
 * Returns the card element and an `updatePrice` function so the billing toggle
 * can swap price text between annual ($65/year) and monthly ($7/month).
 */
function createProCard(): {
  element: HTMLElement;
  updatePrice: (isAnnual: boolean) => void;
} {
  const card = document.createElement('div');
  card.className =
    'relative p-6 rounded-xl border-2 border-accent bg-surface shadow-xl flex flex-col gap-4';

  // Recommended badge — absolutely positioned above card top
  const badgeWrapper = document.createElement('div');
  badgeWrapper.className = 'absolute -top-3 left-1/2 -translate-x-1/2';
  const badgeInner = document.createElement('span');
  badgeInner.className =
    'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-accent text-white shadow-sm';
  badgeInner.textContent = 'Recommended';
  badgeWrapper.appendChild(badgeInner);
  card.appendChild(badgeWrapper);

  // Tier name
  const tierName = document.createElement('h2');
  tierName.className = 'text-xl font-heading font-semibold text-text-primary';
  tierName.textContent = 'Pro';
  card.appendChild(tierName);

  // Price display — element refs stored for toggle updates
  const priceDiv = document.createElement('div');

  const proAmountEl = document.createElement('span');
  proAmountEl.className = 'text-4xl font-bold font-heading text-text-primary';
  proAmountEl.textContent = '$65'; // initial: annual

  const proPeriodEl = document.createElement('span');
  proPeriodEl.className = 'text-sm text-text-muted ml-1';
  proPeriodEl.textContent = '/year'; // initial: annual

  // Sub-label shown when annual is active
  const proSubLabelEl = document.createElement('p');
  proSubLabelEl.className = 'text-xs text-text-muted';
  proSubLabelEl.textContent = '$5.42/mo equivalent';

  priceDiv.appendChild(proAmountEl);
  priceDiv.appendChild(proPeriodEl);
  priceDiv.appendChild(proSubLabelEl);
  card.appendChild(priceDiv);

  // Feature list
  card.appendChild(createFeatureList(PRO_FEATURES));

  // CTA
  const cta = document.createElement('a');
  cta.href = '/register?plan=pro';
  cta.className =
    'mt-auto block text-center px-6 py-3 min-h-[44px] rounded-lg bg-accent text-white font-semibold ' +
    'hover:bg-accent-hover focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg ' +
    'focus:outline-hidden transition-all motion-safe:hover:scale-[1.02] cursor-pointer';
  cta.textContent = 'Get Pro';
  cta.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/register?plan=pro');
  });
  card.appendChild(cta);

  // Price updater — called by the billing toggle on each click
  function updatePrice(isAnnual: boolean): void {
    if (isAnnual) {
      proAmountEl.textContent = '$65';
      proPeriodEl.textContent = '/year';
      proSubLabelEl.classList.remove('hidden');
    } else {
      proAmountEl.textContent = '$7';
      proPeriodEl.textContent = '/month';
      proSubLabelEl.classList.add('hidden');
    }
  }

  return { element: card, updatePrice };
}

/**
 * Build a feature list <ul> from an array of { text, included } items.
 * Included features get a green check icon; excluded items get a muted minus icon.
 */
function createFeatureList(features: Array<{ text: string; included: boolean }>): HTMLElement {
  const list = document.createElement('ul');
  list.className = 'space-y-2 list-none';

  for (const feature of features) {
    const item = document.createElement('li');
    item.className = 'flex items-center gap-2 text-sm';

    if (feature.included) {
      item.appendChild(createIcon(Check, { size: 'sm', class: 'text-success flex-shrink-0' }));
      const label = document.createElement('span');
      label.className = 'text-text-secondary';
      label.textContent = feature.text;
      item.appendChild(label);
    } else {
      item.appendChild(createIcon(Minus, { size: 'sm', class: 'text-text-muted flex-shrink-0' }));
      const label = document.createElement('span');
      label.className = 'text-text-muted';
      label.textContent = feature.text;
      item.appendChild(label);
    }

    list.appendChild(item);
  }

  return list;
}

/**
 * Trust strip: three short trust signals between the tier cards and FAQ.
 */
function createTrustStrip(): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-text-muted';

  const signals = ['Cancel any time', 'No contracts', 'Powered by Stripe'];
  for (const signal of signals) {
    const span = document.createElement('span');
    span.textContent = signal;
    wrapper.appendChild(span);
  }

  return wrapper;
}

/**
 * FAQ section: heading + accordion of 6 <details>/<summary> items.
 */
function createFaqSection(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'space-y-0';
  section.setAttribute('aria-labelledby', 'faq-heading');

  const heading = document.createElement('h2');
  heading.id = 'faq-heading';
  heading.className = 'text-2xl font-heading font-semibold text-text-primary mb-4';
  heading.textContent = 'Frequently asked questions';
  section.appendChild(heading);

  for (const item of FAQ_ITEMS) {
    section.appendChild(createFaqItem(item));
  }

  return section;
}

/**
 * Build a single FAQ accordion item using native <details>/<summary>.
 *
 * The `group` class on <details> and `group-open:rotate-180` on the chevron
 * leverage Tailwind CSS 4's group-open: variant — the <details> element
 * natively receives the `open` attribute when expanded, triggering the variant.
 */
function createFaqItem(item: { question: string; answer: string }): HTMLElement {
  const details = document.createElement('details');
  details.className = 'border-b border-border py-4 group';

  const summary = document.createElement('summary');
  summary.className =
    'flex items-center justify-between cursor-pointer list-none ' +
    'text-text-primary font-medium focus:outline-hidden focus:ring-2 focus:ring-accent rounded';

  const questionText = document.createElement('span');
  questionText.textContent = item.question;
  summary.appendChild(questionText);

  const chevron = createIcon(ChevronDown, {
    size: 'sm',
    class: 'text-text-muted transition-transform flex-shrink-0 group-open:rotate-180',
  });
  summary.appendChild(chevron);

  details.appendChild(summary);

  const answer = document.createElement('p');
  answer.className = 'mt-3 text-sm text-text-secondary leading-relaxed';
  answer.textContent = item.answer;
  details.appendChild(answer);

  return details;
}
