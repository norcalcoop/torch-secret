/**
 * Retro effects engine.
 *
 * Mounts and unmounts animated overlay effects for retro themes.
 * Each mount function returns a cleanup callback. The active cleanup
 * is stored in `currentCleanup` and invoked before any new mount
 * (preventing leaked timers and DOM nodes on theme switch).
 *
 * Effect types:
 *   MatrixRain  — CSS-animated column divs (no setInterval)
 *   PongBall    — setInterval at 16ms
 *   DosTyper    — setTimeout chain (13 lines × 400ms)
 *   Blink       — setInterval at 500ms; cursor char toggle
 *   FloatingEmojis — CSS-animated emoji particles
 *   ScanlineOverlay — pure CSS texture (no animation)
 *
 * All animated effects guard `matchMedia('(prefers-reduced-motion: reduce)')`.
 * Scanline overlay is NOT guarded — it is a static texture, not motion.
 */

import type { RetroTheme } from './retro-data.js';

const EFFECTS_ROOT_ID = 'retro-effects-root';
let currentCleanup: (() => void) | null = null;

// ─── Public API ────────────────────────────────────────────────────────────

export function unmountRetroEffects(): void {
  if (currentCleanup) {
    currentCleanup();
    currentCleanup = null;
  }
  document.getElementById(EFFECTS_ROOT_ID)?.remove();
}

export function mountRetroEffects(id: string, theme: RetroTheme): void {
  // Always clean up previous effects before mounting new ones
  unmountRetroEffects();

  const root = document.createElement('div');
  root.id = EFFECTS_ROOT_ID;
  root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden;';
  document.body.appendChild(root);

  const cleanups: Array<() => void> = [];

  if (theme.matrixMode) cleanups.push(mountMatrixRain(root));
  if (theme.pongMode) cleanups.push(mountPongBall(root));
  if (theme.c64Mode) cleanups.push(mountBlink(root, '#a0a0ff'));
  if (theme.dosMode) {
    cleanups.push(mountDosTyper(root));
    cleanups.push(mountBlink(root, '#ffffff'));
  }
  if (theme.scanlines) cleanups.push(mountScanlineOverlay(root));
  if (theme.floats.length > 0) cleanups.push(mountFloatingEmojis(root, theme));

  currentCleanup = () => {
    for (const fn of cleanups) fn();
  };
}

// ─── Effect mount functions ────────────────────────────────────────────────

/**
 * MatrixRain — 18 CSS-animated column divs.
 * Pure CSS animation via @keyframes mRain in styles.css — no setInterval.
 * Characters: アイウエオカキクケコサシスセソ01 (14 chars per column).
 * Duration: 1.5 + (i%5)*0.7 s; delay: (i%4)*0.4 s.
 */
function mountMatrixRain(root: HTMLElement): () => void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return () => {};
  }

  const CHARS = 'アイウエオカキクケコサシスセソ01';
  const COLUMN_COUNT = 18;
  const CHARS_PER_COLUMN = 14;

  const columns: HTMLElement[] = [];

  for (let i = 0; i < COLUMN_COUNT; i++) {
    const col = document.createElement('div');
    col.style.cssText = [
      'position:absolute',
      `left:${(i / COLUMN_COUNT) * 100}%`,
      'top:0',
      'writing-mode:vertical-rl',
      'font-family:monospace',
      'font-size:14px',
      'animation-name:mRain',
      `animation-duration:${1.5 + (i % 5) * 0.7}s`,
      `animation-delay:${(i % 4) * 0.4}s`,
      'animation-iteration-count:infinite',
      'animation-timing-function:linear',
    ].join(';');

    // Build the column: first char highlighted (#ccffcc), rest green with fading opacity
    for (let j = 0; j < CHARS_PER_COLUMN; j++) {
      const char = CHARS[Math.floor(Math.random() * CHARS.length)];
      const span = document.createElement('span');
      if (j === 0) {
        span.style.color = '#ccffcc';
        span.textContent = char ?? 'ア';
      } else {
        span.style.cssText = `color:#00ff41;opacity:${1 - j * 0.06}`;
        span.textContent = char ?? '0';
      }
      col.appendChild(span);
    }

    root.appendChild(col);
    columns.push(col);
  }

  return () => {
    for (const col of columns) col.remove();
  };
}

/**
 * PongBall — setInterval at 16ms (~60fps).
 * Two paddles, one ball, one center dashed line.
 * Ball bounces at edges; paddles track ball Y.
 */
function mountPongBall(root: HTMLElement): () => void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return () => {};
  }

  // Create elements
  const leftPaddle = makePaddle('5%');
  const rightPaddle = makePaddle('90%');
  const ball = document.createElement('div');
  ball.style.cssText =
    'position:absolute;width:10px;height:10px;background:#fff;border-radius:50%;' +
    'transform:translate(-50%,-50%);';
  const centerLine = document.createElement('div');
  centerLine.style.cssText =
    'position:absolute;left:50%;top:0;width:2px;height:100%;' +
    'border-left:2px dashed rgba(255,255,255,0.3);';

  root.appendChild(leftPaddle);
  root.appendChild(rightPaddle);
  root.appendChild(ball);
  root.appendChild(centerLine);

  // Ball state (percentage coordinates)
  let bx = 50;
  let by = 50;
  let dx = 0.45;
  let dy = 0.32;

  const intervalId = setInterval(() => {
    bx += dx;
    by += dy;

    // Bounce off left/right edges
    if (bx > 97 || bx < 3) dx *= -1;
    // Bounce off top/bottom edges
    if (by > 93 || by < 7) dy *= -1;

    // Update ball position
    ball.style.left = `${bx}%`;
    ball.style.top = `${by}%`;

    // Move paddles to follow ball Y (clamped)
    const paddleTop = Math.min(Math.max(by, 5), 78);
    leftPaddle.style.top = `${paddleTop}%`;
    rightPaddle.style.top = `${paddleTop}%`;
  }, 16);

  return () => {
    clearInterval(intervalId);
    leftPaddle.remove();
    rightPaddle.remove();
    ball.remove();
    centerLine.remove();
  };
}

function makePaddle(left: string): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText =
    `position:absolute;left:${left};top:50%;` +
    'width:8px;height:56px;background:#fff;transform:translate(-50%,-50%);border-radius:4px;';
  return el;
}

/**
 * DosTyper — 13-line sequential typing effect.
 * Lines shown one at a time via setTimeout (400ms per line).
 * prefers-reduced-motion: show all 13 lines immediately, no timeouts.
 */
function mountDosTyper(root: HTMLElement): () => void {
  const DOS_LINES = [
    { text: 'Microsoft MS-DOS Version 6.22', color: '#ffff55' },
    { text: 'Copyright Microsoft Corp 1981-1994.', color: '#ffff55' },
    { text: '', color: '#cccccc' },
    { text: 'C:\\> DIR', color: '#fff' },
    { text: ' Volume in drive C is DOSDRIVE', color: '#cccccc' },
    { text: ' Directory of C:\\', color: '#cccccc' },
    { text: '', color: '#cccccc' },
    { text: ' COMMAND .COM    54,619', color: '#cccccc' },
    { text: ' CONFIG  .SYS       256', color: '#cccccc' },
    { text: ' AUTOEXEC.BAT       128', color: '#cccccc' },
    { text: ' GAMES   <DIR>', color: '#cccccc' },
    { text: '', color: '#cccccc' },
    { text: 'C:\\>', color: '#fff' },
  ] as const;

  const container = document.createElement('div');
  container.style.cssText =
    'position:absolute;bottom:20px;left:20px;right:20px;font-family:"Courier New",monospace;' +
    'font-size:13px;line-height:1.6;';
  root.appendChild(container);

  const timeouts: ReturnType<typeof setTimeout>[] = [];

  const makeLine = (line: { text: string; color: string }): HTMLElement => {
    const el = document.createElement('div');
    el.setAttribute('data-dos-line', '');
    el.style.color = line.color;
    el.textContent = line.text;
    return el;
  };

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // Show all lines immediately
    for (const line of DOS_LINES) {
      container.appendChild(makeLine(line));
    }
  } else {
    // Sequential typing — one line per 400ms
    for (let i = 0; i < DOS_LINES.length; i++) {
      const line = DOS_LINES[i];
      const t = setTimeout(() => {
        container.appendChild(makeLine(line));
      }, i * 400);
      timeouts.push(t);
    }
  }

  return () => {
    for (const t of timeouts) clearTimeout(t);
    container.remove();
  };
}

/**
 * Blink cursor — 500ms setInterval toggling CSS visibility.
 * char: '█'; color provided by caller (C64: #a0a0ff, DOS: #fff).
 * prefers-reduced-motion: render static visible char, no interval.
 */
function mountBlink(root: HTMLElement, color: string): () => void {
  const cursor = document.createElement('div');
  cursor.style.cssText =
    `position:absolute;bottom:20px;right:20px;color:${color};` +
    'font-family:monospace;font-size:16px;';
  cursor.textContent = '█';
  root.appendChild(cursor);

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // Static visible cursor — no animation
    return () => cursor.remove();
  }

  let visible = true;
  const intervalId = setInterval(() => {
    visible = !visible;
    cursor.style.visibility = visible ? 'visible' : 'hidden';
  }, 500);

  return () => {
    clearInterval(intervalId);
    cursor.remove();
  };
}

/**
 * FloatingEmojis — 5 fixed-position emoji particles with floatY CSS animation.
 * CSS keyframe @keyframes floatY must be present in styles.css.
 * prefers-reduced-motion: skip mounting entirely (return no-op immediately).
 */
function mountFloatingEmojis(root: HTMLElement, theme: RetroTheme): () => void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return () => {};
  }

  const emojis = theme.floats.slice(0, 5);
  const elements: HTMLElement[] = [];

  for (let i = 0; i < emojis.length; i++) {
    const el = document.createElement('div');
    el.style.cssText = [
      'position:fixed',
      `left:${8 + i * 18}%`,
      `top:${12 + (i % 3) * 25}%`,
      'font-size:18px',
      'opacity:0.28',
      'pointer-events:none',
      'z-index:0',
      'animation-name:floatY',
      `animation-duration:${2 + i * 0.4}s`,
      `animation-delay:${i * 0.3}s`,
      'animation-iteration-count:infinite',
      'animation-timing-function:ease-in-out',
      'color:' + theme.primary,
      'font-family:monospace',
    ].join(';');
    el.textContent = emojis[i] ?? '';
    root.appendChild(el);
    elements.push(el);
  }

  return () => {
    for (const el of elements) el.remove();
  };
}

/**
 * ScanlineOverlay — pure CSS texture, no animation.
 * repeating-linear-gradient creates horizontal scan lines.
 * prefers-reduced-motion does NOT apply (texture is not motion).
 */
function mountScanlineOverlay(root: HTMLElement): () => void {
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;pointer-events:none;z-index:1;' +
    'background:repeating-linear-gradient(' +
    'to bottom,' +
    'transparent,transparent 1px,' +
    'rgba(0,0,0,0.2) 1px,rgba(0,0,0,0.2) 2px)';
  root.appendChild(overlay);

  return () => overlay.remove();
}
