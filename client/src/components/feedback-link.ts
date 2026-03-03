/**
 * Shared feedback link component.
 *
 * Renders a plain anchor that opens the Tally.so feedback form in a new tab
 * with proper security attributes (target=_blank, rel=noopener noreferrer).
 *
 * TALLY_FEEDBACK_URL is a named constant for easy find-and-replace when the
 * real Tally form is created. Update the value here to update all placements.
 *
 * ZK invariant: The URL is a static string with no query parameters — no
 * userId, secretId, or identifying data may be appended.
 */

/** Tally.so feedback form URL. Update this constant when the real form is created. */
export const TALLY_FEEDBACK_URL = 'https://tally.so/r/Y5ZV56';

/**
 * Create an anchor element linking to the feedback form.
 *
 * @param url - The feedback form URL (use TALLY_FEEDBACK_URL constant)
 * @returns HTMLAnchorElement with target=_blank and rel=noopener noreferrer
 */
export function createFeedbackLink(url: string): HTMLAnchorElement {
  const feedbackLink = document.createElement('a');
  feedbackLink.href = url;
  feedbackLink.target = '_blank';
  feedbackLink.rel = 'noopener noreferrer';
  feedbackLink.textContent = 'Share feedback';
  feedbackLink.className =
    'inline-block py-2 text-sm text-text-muted hover:text-text-secondary ' +
    'focus:ring-2 focus:ring-accent focus:outline-hidden rounded transition-colors';
  return feedbackLink;
}
