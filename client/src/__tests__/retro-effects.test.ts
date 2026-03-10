import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// These imports will fail (RED) until retro-effects.ts is created.
import { mountRetroEffects, unmountRetroEffects } from '../retro-effects.js';
import { THEMES } from '../retro-data.js';

const EFFECTS_ROOT_ID = 'retro-effects-root';

// Helper to mock matchMedia for prefers-reduced-motion
function mockMatchMedia(prefersReducedMotion: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)' ? prefersReducedMotion : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe('retro-effects engine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Restore real matchMedia (default: no reduced motion)
    vi.restoreAllMocks();
    mockMatchMedia(false);
    // Clean up any leftover effect roots
    document.getElementById(EFFECTS_ROOT_ID)?.remove();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.getElementById(EFFECTS_ROOT_ID)?.remove();
  });

  describe('unmountRetroEffects', () => {
    it('removes #retro-effects-root from document.body when present', () => {
      // Manually create the root to simulate a mounted state
      const div = document.createElement('div');
      div.id = EFFECTS_ROOT_ID;
      document.body.appendChild(div);

      unmountRetroEffects();

      expect(document.getElementById(EFFECTS_ROOT_ID)).toBeNull();
    });

    it('does not throw when no effects are mounted (safe double-unmount)', () => {
      // Call unmount twice with no mount — should not throw or cause errors
      let error: unknown = undefined;
      try {
        unmountRetroEffects();
      } catch (e) {
        error = e;
      }
      expect(error).toBeUndefined();
      try {
        unmountRetroEffects();
      } catch (e) {
        error = e;
      }
      expect(error).toBeUndefined();
    });

    it('calls clearInterval for PongBall timer on unmount', () => {
      const clearIntervalSpy = vi.spyOn(window, 'clearInterval');

      // Mount pong theme which uses setInterval
      mountRetroEffects('pong', THEMES['pong']);
      expect(document.getElementById(EFFECTS_ROOT_ID)).not.toBeNull();

      unmountRetroEffects();

      // clearInterval should have been called (pong cleanup)
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('mountRetroEffects', () => {
    it('creates #retro-effects-root in document.body', () => {
      mountRetroEffects('mario', THEMES['mario']);
      expect(document.getElementById(EFFECTS_ROOT_ID)).not.toBeNull();
    });

    it('replaces existing #retro-effects-root when called twice (no two roots)', () => {
      mountRetroEffects('mario', THEMES['mario']);
      mountRetroEffects('pong', THEMES['pong']);

      const roots = document.querySelectorAll(`#${EFFECTS_ROOT_ID}`);
      expect(roots.length).toBe(1);
    });

    it('calls unmountRetroEffects() before mounting new effects (no timer leaks on switch)', () => {
      const clearIntervalSpy = vi.spyOn(window, 'clearInterval');

      mountRetroEffects('pong', THEMES['pong']);
      // At this point pong interval is running; mounting a new theme must clear it
      mountRetroEffects('mario', THEMES['mario']);

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('MatrixRain — prefers-reduced-motion', () => {
    it('does NOT create any DOM elements when prefers-reduced-motion is reduce', () => {
      mockMatchMedia(true);

      // Mount matrix theme which uses matrixMode
      mountRetroEffects('matrix', THEMES['matrix']);

      const root = document.getElementById(EFFECTS_ROOT_ID);
      // Root itself is always created; but matrix columns should NOT be added
      expect(root).not.toBeNull();
      // No column divs inside root
      const columns = root?.querySelectorAll('[style*="writing-mode"]');
      expect(columns?.length ?? 0).toBe(0);
    });

    it('creates 18 column divs under reduced motion OFF', () => {
      mockMatchMedia(false);

      mountRetroEffects('matrix', THEMES['matrix']);

      const root = document.getElementById(EFFECTS_ROOT_ID);
      const columns = root?.querySelectorAll('[style*="writing-mode"]');
      expect(columns?.length).toBe(18);
    });
  });

  describe('FloatingEmojis — prefers-reduced-motion', () => {
    it('does NOT mount floating emojis when prefers-reduced-motion is reduce', () => {
      mockMatchMedia(true);

      // Mario theme has floats: ['🍄','⭐','🪙','🌿','🏁']
      mountRetroEffects('mario', THEMES['mario']);

      const root = document.getElementById(EFFECTS_ROOT_ID);
      // Emojis should not be present
      const emojiEls = root?.querySelectorAll('[style*="font-size"]');
      expect(emojiEls?.length ?? 0).toBe(0);
    });

    it('creates 5 emoji elements when reduced motion is OFF', () => {
      mockMatchMedia(false);

      mountRetroEffects('mario', THEMES['mario']);

      const root = document.getElementById(EFFECTS_ROOT_ID);
      const emojiEls = root?.querySelectorAll('[style*="font-size: 18px"]');
      expect(emojiEls?.length).toBe(5);
    });
  });

  describe('PongBall — timer lifecycle', () => {
    it('starts a setInterval on mount', () => {
      const setIntervalSpy = vi.spyOn(window, 'setInterval');

      mountRetroEffects('pong', THEMES['pong']);

      expect(setIntervalSpy).toHaveBeenCalled();
    });

    it('calls clearInterval on unmount — no leaked timer', () => {
      const clearIntervalSpy = vi.spyOn(window, 'clearInterval');

      mountRetroEffects('pong', THEMES['pong']);
      unmountRetroEffects();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('does NOT start PongBall timer under prefers-reduced-motion', () => {
      mockMatchMedia(true);
      const setIntervalSpy = vi.spyOn(window, 'setInterval');

      mountRetroEffects('pong', THEMES['pong']);

      // setInterval should not be called for pong when reduced motion is active
      const callsWithPongRate = setIntervalSpy.mock.calls.filter(([_fn, ms]) => ms === 16);
      expect(callsWithPongRate.length).toBe(0);
    });
  });

  describe('Blink cursor — prefers-reduced-motion', () => {
    it('does NOT call setInterval for Blink when prefers-reduced-motion is reduce', () => {
      mockMatchMedia(true);
      const setIntervalSpy = vi.spyOn(window, 'setInterval');

      // c64 theme has c64Mode which triggers Blink
      mountRetroEffects('c64', THEMES['c64']);

      const blinkCalls = setIntervalSpy.mock.calls.filter(([_fn, ms]) => ms === 500);
      expect(blinkCalls.length).toBe(0);
    });

    it('starts a 500ms setInterval for Blink cursor when reduced motion is OFF', () => {
      mockMatchMedia(false);
      const setIntervalSpy = vi.spyOn(window, 'setInterval');

      mountRetroEffects('c64', THEMES['c64']);

      const blinkCalls = setIntervalSpy.mock.calls.filter(([_fn, ms]) => ms === 500);
      expect(blinkCalls.length).toBeGreaterThan(0);
    });
  });

  describe('DosTyper — prefers-reduced-motion', () => {
    it('renders all 13 lines immediately when prefers-reduced-motion is reduce (no setTimeout)', () => {
      mockMatchMedia(true);
      const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

      mountRetroEffects('dos', THEMES['dos']);

      const root = document.getElementById(EFFECTS_ROOT_ID);
      // All 13 lines should be visible immediately
      const lines = root?.querySelectorAll('[data-dos-line]');
      expect(lines?.length).toBe(13);
      // No setTimeout calls
      expect(setTimeoutSpy).not.toHaveBeenCalled();
    });

    it('uses setTimeout chain for line-by-line typing when reduced motion is OFF', () => {
      mockMatchMedia(false);
      const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

      mountRetroEffects('dos', THEMES['dos']);

      // At least one setTimeout should be queued for the typing effect
      expect(setTimeoutSpy).toHaveBeenCalled();
    });
  });
});
