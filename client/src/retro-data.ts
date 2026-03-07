/**
 * Retro theme data module.
 *
 * Pure data — no DOM, no localStorage, no side effects.
 * All downstream modules (retro-theme.ts, retro-effects.ts, UI) import from here.
 *
 * Theme count: 21 (authoritative per /Downloads/retro-themes.jsx THEMES object).
 * REQUIREMENTS.md / ROADMAP say "22" — treat 21 as correct; spec file is the source of truth.
 */

export const RETRO_STORAGE_KEY = 'retro-theme';

export interface NavEntry {
  i: string;
  l: string;
}

export interface RetroTheme {
  id: string;
  name: string;
  group: 'game' | 'anime' | 'cartoon';
  bg: string;
  text: string;
  primary: string;
  accent: string;
  cardBg: string;
  cardBorder: string;
  navBg: string;
  bgImg: string;
  font: string;
  floats: string[];
  nav: NavEntry[];
  // Special effect mode flags (optional)
  matrixMode?: boolean;
  pongMode?: boolean;
  c64Mode?: boolean;
  dosMode?: boolean;
  macMode?: boolean;
  scanlines?: boolean;
  btnBg?: string;
  btnShadow?: string;
  btnBorder?: string;
}

// FOWT-SYNC: compact color values in client/index.html must match bg/text/primary/accent/cardBg/cardBorder/navBg for each theme ID here.
export const THEMES: Record<string, RetroTheme> = {
  // ─── RETRO GAMES ──────────────────────────────────────────────────────────
  mario: {
    id: 'mario',
    name: 'Super Mario Bros.',
    group: 'game',
    font: "'Press Start 2P',monospace",
    bg: '#5c94fc',
    bgImg:
      'repeating-linear-gradient(0deg,transparent,transparent 31px,rgba(255,255,255,0.07) 31px,rgba(255,255,255,0.07) 32px),repeating-linear-gradient(90deg,transparent,transparent 31px,rgba(255,255,255,0.07) 31px,rgba(255,255,255,0.07) 32px)',
    primary: '#e52521',
    accent: '#fbf236',
    text: '#fff',
    cardBg: 'rgba(0,0,0,0.6)',
    cardBorder: '3px solid #fbf236',
    btnBg: '#e52521',
    btnBorder: 'none',
    btnShadow: '0 6px 0 #8b0000',
    navBg: '#000',
    nav: [
      { l: 'WORLD', i: 'mario_home' },
      { l: 'COINS', i: 'mario_coin' },
      { l: 'STARS', i: 'mario_star' },
      { l: 'ITEMS', i: 'mario_mush' },
      { l: 'GOAL', i: 'mario_flag' },
    ],
    floats: ['🍄', '⭐', '🪙', '🌿', '🏁'],
  },

  zelda: {
    id: 'zelda',
    name: 'The Legend of Zelda',
    group: 'game',
    font: "'Press Start 2P',monospace",
    bg: '#1a1a0f',
    bgImg:
      'radial-gradient(ellipse at 20% 50%,rgba(60,100,20,0.3),transparent 60%),radial-gradient(ellipse at 80% 20%,rgba(100,80,20,0.2),transparent 50%)',
    primary: '#c8a800',
    accent: '#8bc34a',
    text: '#e8d48b',
    cardBg: 'rgba(20,30,10,0.85)',
    cardBorder: '2px solid #c8a800',
    btnBg: '#2d5a1b',
    btnBorder: 'none',
    btnShadow: '0 4px 0 #0d2208,0 0 20px rgba(200,168,0,0.4)',
    navBg: '#0d1505',
    nav: [
      { l: 'KINGDOM', i: 'zelda_home' },
      { l: 'QUEST', i: 'zelda_sword' },
      { l: 'SHIELD', i: 'zelda_shield' },
      { l: 'HEARTS', i: 'zelda_heart' },
      { l: 'RUPEES', i: 'zelda_rupee' },
    ],
    floats: ['⚔️', '🛡️', '💎', '🌿', '🗝️'],
  },

  contra: {
    id: 'contra',
    name: 'Contra',
    group: 'game',
    font: "'Press Start 2P',monospace",
    bg: '#0a0a0a',
    bgImg:
      'repeating-linear-gradient(45deg,transparent,transparent 10px,rgba(200,0,0,0.03) 10px,rgba(200,0,0,0.03) 11px)',
    primary: '#cc0000',
    accent: '#ffcc00',
    text: '#fff',
    cardBg: 'rgba(0,0,0,0.85)',
    cardBorder: '2px solid #cc0000',
    btnBg: '#cc0000',
    btnBorder: 'none',
    btnShadow: '0 5px 0 #660000,0 0 20px rgba(204,0,0,0.5)',
    navBg: '#110000',
    nav: [
      { l: 'BASE', i: 'contra_home' },
      { l: 'WEAPONS', i: 'contra_gun' },
      { l: 'COMBAT', i: 'contra_expl' },
      { l: 'AMMO', i: 'contra_bullet' },
      { l: 'KILLS', i: 'contra_skull' },
    ],
    floats: ['💥', '🔫', '💀', '🎯', '☠️'],
  },

  mk: {
    id: 'mk',
    name: 'Mortal Kombat',
    group: 'game',
    font: "'Press Start 2P',monospace",
    bg: '#0a0000',
    bgImg: 'radial-gradient(ellipse at 50% 100%,rgba(200,0,0,0.3),transparent 70%)',
    primary: '#dd0000',
    accent: '#ff4400',
    text: '#ffdddd',
    cardBg: 'rgba(20,0,0,0.9)',
    cardBorder: '2px solid #dd0000',
    btnBg: '#880000',
    btnBorder: 'none',
    btnShadow: '0 5px 0 #440000,0 0 30px rgba(220,0,0,0.4)',
    navBg: '#050000',
    nav: [
      { l: 'ARENA', i: 'mk_home' },
      { l: 'KOMBAT', i: 'mk_fist' },
      { l: 'DRAGON', i: 'mk_dragon' },
      { l: 'FATALITY', i: 'mk_skull' },
      { l: 'POWER', i: 'mk_bolt' },
    ],
    floats: ['🩸', '⚡', '💀', '🔥', '👊'],
  },

  sf: {
    id: 'sf',
    name: 'Street Fighter II',
    group: 'game',
    font: "'Press Start 2P',monospace",
    bg: '#1a0033',
    bgImg:
      'repeating-linear-gradient(90deg,transparent,transparent 60px,rgba(255,255,0,0.03) 60px,rgba(255,255,0,0.04) 61px)',
    primary: '#ff4444',
    accent: '#4488ff',
    text: '#fff',
    cardBg: 'rgba(10,0,30,0.9)',
    cardBorder: '2px solid #ffdd00',
    btnBg: '#cc1111',
    btnBorder: 'none',
    btnShadow: '0 5px 0 #660000,0 0 20px rgba(255,68,68,0.4)',
    navBg: '#100022',
    nav: [
      { l: 'DOJO', i: 'sf_home' },
      { l: 'HADOUKEN', i: 'sf_hadouken' },
      { l: 'RANKING', i: 'sf_star' },
      { l: 'CHAMPION', i: 'sf_trophy' },
      { l: 'SELECT', i: 'sf_pad' },
    ],
    floats: ['🥊', '🌊', '⚡', '🏆', '🎯'],
  },

  pong: {
    id: 'pong',
    name: 'Pong',
    group: 'game',
    font: "'Press Start 2P',monospace",
    bg: '#000',
    bgImg: 'none',
    primary: '#fff',
    accent: '#aaa',
    text: '#fff',
    cardBg: 'rgba(255,255,255,0.05)',
    cardBorder: '2px solid #fff',
    btnBg: 'transparent',
    btnBorder: '2px solid #fff',
    btnShadow: 'none',
    navBg: '#000',
    nav: [
      { l: 'COURT', i: 'pong_home' },
      { l: 'PADDLE', i: 'pong_pad' },
      { l: 'BALL', i: 'pong_ball' },
      { l: 'SCORE', i: 'pong_score' },
      { l: 'OPTIONS', i: 'pong_cfg' },
    ],
    floats: ['◉', '▌', '▐', '—', '•'],
    pongMode: true,
  },

  c64: {
    id: 'c64',
    name: 'Commodore 64',
    group: 'game',
    font: "'Press Start 2P',monospace",
    bg: '#4040b8',
    bgImg: 'none',
    primary: '#a0a0ff',
    accent: '#6060cc',
    text: '#a0a0ff',
    cardBg: '#2020a0',
    cardBorder: 'none',
    btnBg: '#6060cc',
    btnBorder: 'none',
    btnShadow: 'none',
    navBg: '#4040b8',
    nav: [
      { l: 'HOME', i: 'c64_home' },
      { l: 'READY.', i: 'c64_cur' },
      { l: 'DISK', i: 'c64_disk' },
      { l: 'INPUT', i: 'c64_keys' },
      { l: 'SID', i: 'c64_chip' },
    ],
    floats: ['💾', '📟', '⌨️', '📺', '🔌'],
    c64Mode: true,
  },

  dos: {
    id: 'dos',
    name: 'MS-DOS',
    group: 'game',
    font: "'Courier New',monospace",
    bg: '#000080',
    bgImg: 'none',
    primary: '#ffffff',
    accent: '#55ffff',
    text: '#cccccc',
    cardBg: 'rgba(0,0,100,0.9)',
    cardBorder: '1px solid #888',
    btnBg: '#aaaaaa',
    btnBorder: 'none',
    btnShadow: 'none',
    navBg: '#000000',
    nav: [
      { l: 'C:\\', i: 'dos_home' },
      { l: 'DIR', i: 'dos_folder' },
      { l: 'PROMPT', i: 'dos_prompt' },
      { l: 'DISK', i: 'dos_floppy' },
      { l: 'AUTOEXEC', i: 'dos_bat' },
    ],
    floats: ['█', '▓', '░', '▄', '▀'],
    dosMode: true,
    scanlines: true,
  },

  mac: {
    id: 'mac',
    name: 'Macintosh',
    group: 'game',
    font: "Geneva,Chicago,'Helvetica Neue',sans-serif",
    bg: '#aaaaaa',
    bgImg: 'repeating-linear-gradient(45deg,#999 0,#999 1px,#aaa 1px,#aaa 9px)',
    primary: '#000000',
    accent: '#555555',
    text: '#000000',
    cardBg: '#ffffff',
    cardBorder: '2px solid #000',
    btnBg: '#ffffff',
    btnBorder: '2px solid #000',
    btnShadow: '2px 2px 0 #000',
    navBg: '#000000',
    nav: [
      { l: 'Finder', i: 'mac_home' },
      { l: 'Apple', i: 'mac_apple' },
      { l: 'Window', i: 'mac_win' },
      { l: 'Mac HD', i: 'mac_disk' },
      { l: 'Trash', i: 'mac_trash' },
    ],
    floats: ['□', '◇', '△', '○', '✦'],
    macMode: true,
  },

  matrix: {
    id: 'matrix',
    name: 'The Matrix',
    group: 'game',
    font: "'Press Start 2P',monospace",
    bg: '#000',
    bgImg: 'none',
    primary: '#00ff41',
    accent: '#00aa22',
    text: '#00ff41',
    cardBg: 'rgba(0,30,0,0.8)',
    cardBorder: '1px solid #00ff41',
    btnBg: 'transparent',
    btnBorder: '1px solid #00ff41',
    btnShadow: '0 0 20px rgba(0,255,65,0.3)',
    navBg: 'rgba(0,5,0,0.95)',
    nav: [
      { l: 'CONSTRUCT', i: 'mat_home' },
      { l: 'RAIN', i: 'mat_rain' },
      { l: 'ORACLE', i: 'mat_eye' },
      { l: 'CODE', i: 'mat_code' },
      { l: 'CHOICE', i: 'mat_pill' },
    ],
    floats: ['0', '1', 'ア', 'ウ', 'エ'],
    matrixMode: true,
  },

  minecraft: {
    id: 'minecraft',
    name: 'Minecraft',
    group: 'game',
    font: "'Press Start 2P',monospace",
    bg: '#87CEEB',
    bgImg: 'none',
    primary: '#5d9b3f',
    accent: '#8B5A2B',
    text: '#222',
    cardBg: 'rgba(141,101,63,0.85)',
    cardBorder: '3px solid #5d9b3f',
    btnBg: '#5d9b3f',
    btnBorder: 'none',
    btnShadow: '0 5px 0 #2d6a1f',
    navBg: '#3d6b2f',
    nav: [
      { l: 'WORLD', i: 'mc_home' },
      { l: 'CRAFT', i: 'mc_block' },
      { l: 'MINE', i: 'mc_diamond' },
      { l: 'FIGHT', i: 'mc_sword' },
      { l: 'CREEP', i: 'mc_creeper' },
    ],
    floats: ['⛏️', '🌲', '💎', '🧱', '🐸'],
  },

  pokemon: {
    id: 'pokemon',
    name: 'Pokémon',
    group: 'game',
    font: "'Press Start 2P',monospace",
    bg: '#cc0000',
    bgImg:
      'repeating-linear-gradient(45deg,rgba(0,0,0,0.05) 0,rgba(0,0,0,0.05) 2px,transparent 2px,transparent 8px)',
    primary: '#ffcc00',
    accent: '#3b4cca',
    text: '#fff',
    cardBg: 'rgba(0,0,0,0.5)',
    cardBorder: '2px solid #ffcc00',
    btnBg: '#ffcc00',
    btnBorder: 'none',
    btnShadow: '0 5px 0 #cc9900',
    navBg: '#990000',
    nav: [
      { l: 'POKEDEX', i: 'poke_home' },
      { l: 'POKEBALL', i: 'poke_ball' },
      { l: 'BATTLE', i: 'poke_bolt' },
      { l: 'GRASS', i: 'poke_leaf' },
      { l: 'FIRE', i: 'poke_fire' },
    ],
    floats: ['⚡', '🔴', '⚪', '🌿', '🔥'],
  },

  tetris: {
    id: 'tetris',
    name: 'Tetris',
    group: 'game',
    font: "'Press Start 2P',monospace",
    bg: '#000',
    bgImg: 'none',
    primary: '#00ffff',
    accent: '#ffff00',
    text: '#fff',
    cardBg: 'rgba(0,0,40,0.9)',
    cardBorder: '2px solid #00ffff',
    btnBg: '#00ffff',
    btnBorder: 'none',
    btnShadow: '0 4px 0 #009999',
    navBg: '#000022',
    nav: [
      { l: 'BOARD', i: 'tet_home' },
      { l: 'I-PIECE', i: 'tet_I' },
      { l: 'T-PIECE', i: 'tet_T' },
      { l: 'S-PIECE', i: 'tet_S' },
      { l: 'CLEAR!', i: 'tet_clear' },
    ],
    floats: ['🟦', '🟨', '🟥', '🟧', '🟩'],
  },

  duckhunt: {
    id: 'duckhunt',
    name: 'Duck Hunt',
    group: 'game',
    font: "'Press Start 2P',monospace",
    bg: '#88ccff',
    bgImg: 'linear-gradient(to bottom,#5599ff 0%,#88ccff 40%,#5d9b3f 60%,#4a8a2f 100%)',
    primary: '#cc4400',
    accent: '#ffcc00',
    text: '#fff',
    cardBg: 'rgba(0,60,0,0.8)',
    cardBorder: '2px solid #ffcc00',
    btnBg: '#cc4400',
    btnBorder: 'none',
    btnShadow: '0 4px 0 #882200',
    navBg: '#2a5a10',
    nav: [
      { l: 'FIELD', i: 'dh_home' },
      { l: 'SHOOT', i: 'dh_gun' },
      { l: 'DUCK', i: 'dh_duck' },
      { l: 'DOG', i: 'dh_dog' },
      { l: 'AIM', i: 'dh_target' },
    ],
    floats: ['🦆', '🎯', '🔫', '🌿', '☁️'],
  },

  punchout: {
    id: 'punchout',
    name: "Mike Tyson's Punch-Out!!",
    group: 'game',
    font: "'Press Start 2P',monospace",
    bg: '#111133',
    bgImg: 'radial-gradient(ellipse at 50% 30%,rgba(255,200,0,0.15) 0%,transparent 70%)',
    primary: '#ffcc00',
    accent: '#ff2222',
    text: '#fff',
    cardBg: 'rgba(0,0,50,0.85)',
    cardBorder: '2px solid #ffcc00',
    btnBg: '#ffcc00',
    btnBorder: 'none',
    btnShadow: '0 5px 0 #997700',
    navBg: '#050520',
    nav: [
      { l: 'RING', i: 'po_home' },
      { l: 'PUNCH', i: 'po_glove' },
      { l: 'STAR', i: 'po_star' },
      { l: 'BELT', i: 'po_belt' },
      { l: 'K.O.', i: 'po_ko' },
    ],
    floats: ['🥊', '⭐', '💪', '🏆', '🎶'],
  },

  // ─── RETRO ANIME ──────────────────────────────────────────────────────────
  dbz: {
    id: 'dbz',
    name: 'Dragon Ball Z',
    group: 'anime',
    font: "'Press Start 2P',monospace",
    bg: '#0a0a1a',
    bgImg:
      'radial-gradient(ellipse at 30% 40%,rgba(255,100,0,0.2),transparent 60%),radial-gradient(ellipse at 70% 60%,rgba(255,200,0,0.15),transparent 50%)',
    primary: '#ff7700',
    accent: '#ffee00',
    text: '#ffeecc',
    cardBg: 'rgba(20,10,0,0.9)',
    cardBorder: '2px solid #ff7700',
    btnBg: '#ff7700',
    btnBorder: 'none',
    btnShadow: '0 5px 0 #882200,0 0 30px rgba(255,120,0,0.5)',
    navBg: '#050510',
    nav: [
      { l: 'EARTH', i: 'dbz_home' },
      { l: 'KAMEHAMEHA', i: 'dbz_blast' },
      { l: 'SAIYAN', i: 'dbz_hair' },
      { l: 'DRAGON', i: 'dbz_dragon' },
      { l: 'POWER', i: 'dbz_saiyan' },
    ],
    floats: ['🔮', '⚡', '🔥', '✨', '🌟'],
  },

  astroboy: {
    id: 'astroboy',
    name: 'Astro Boy',
    group: 'anime',
    font: "'Press Start 2P',monospace",
    bg: '#003366',
    bgImg:
      'radial-gradient(circle at 50% 30%,rgba(100,180,255,0.2),transparent 60%),repeating-linear-gradient(0deg,transparent,transparent 20px,rgba(255,255,255,0.02) 20px,rgba(255,255,255,0.02) 21px)',
    primary: '#4488ff',
    accent: '#ffffff',
    text: '#aaccff',
    cardBg: 'rgba(0,20,60,0.9)',
    cardBorder: '2px solid #4488ff',
    btnBg: '#4488ff',
    btnBorder: 'none',
    btnShadow: '0 5px 0 #1144aa,0 0 20px rgba(68,136,255,0.4)',
    navBg: '#001133',
    nav: [
      { l: 'METRO CITY', i: 'ab_home' },
      { l: 'ROCKETS', i: 'ab_rocket' },
      { l: 'ATOM', i: 'ab_atom' },
      { l: 'PUNCH', i: 'ab_fist' },
      { l: 'HERO', i: 'ab_star' },
    ],
    floats: ['🤖', '✨', '🚀', '💡', '🌙'],
  },

  // ─── RETRO CARTOONS ───────────────────────────────────────────────────────
  tmnt: {
    id: 'tmnt',
    name: 'Teenage Mutant Ninja Turtles',
    group: 'cartoon',
    font: "'Press Start 2P',monospace",
    bg: '#0d1f0d',
    bgImg:
      'radial-gradient(ellipse at 30% 70%,rgba(0,120,0,0.25),transparent 55%),radial-gradient(ellipse at 70% 20%,rgba(0,80,0,0.2),transparent 50%),repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(0,255,0,0.03) 39px,rgba(0,255,0,0.03) 40px)',
    primary: '#55cc22',
    accent: '#ffcc00',
    text: '#aaffaa',
    cardBg: 'rgba(0,30,0,0.88)',
    cardBorder: '2px solid #55cc22',
    btnBg: '#336611',
    btnBorder: 'none',
    btnShadow: '0 5px 0 #1a3308,0 0 20px rgba(85,204,34,0.4)',
    navBg: '#050f05',
    nav: [
      { l: 'LAIR', i: 'tmnt_shell' },
      { l: 'PIZZA', i: 'tmnt_pizza' },
      { l: 'MASK', i: 'tmnt_mask' },
      { l: 'WEAPONS', i: 'tmnt_nunchaku' },
      { l: 'FIGHT', i: 'tmnt_sai' },
    ],
    floats: ['🐢', '🍕', '⚔️', '🌿', '🗡️'],
  },

  gijoe: {
    id: 'gijoe',
    name: 'G.I. Joe',
    group: 'cartoon',
    font: "'Press Start 2P',monospace",
    bg: '#0d1a0a',
    bgImg:
      'repeating-linear-gradient(45deg,rgba(60,90,30,0.15) 0,rgba(60,90,30,0.15) 2px,transparent 2px,transparent 14px),repeating-linear-gradient(-45deg,rgba(60,90,30,0.1) 0,rgba(60,90,30,0.1) 2px,transparent 2px,transparent 14px)',
    primary: '#7ab230',
    accent: '#f5c800',
    text: '#cce8a0',
    cardBg: 'rgba(10,25,5,0.9)',
    cardBorder: '2px solid #7ab230',
    btnBg: '#4a6a20',
    btnBorder: 'none',
    btnShadow: '0 5px 0 #253510,0 0 15px rgba(122,178,48,0.3)',
    navBg: '#060e04',
    nav: [
      { l: 'BASE', i: 'gij_helmet' },
      { l: 'DOG TAG', i: 'gij_dog' },
      { l: 'RIFLE', i: 'gij_rifle' },
      { l: 'COBRA', i: 'gij_cobra' },
      { l: 'AIRSTRIKE', i: 'gij_jet' },
    ],
    floats: ['🪖', '⭐', '🔫', '🦅', '💥'],
  },

  transformers: {
    id: 'transformers',
    name: 'Transformers',
    group: 'cartoon',
    font: "'Press Start 2P',monospace",
    bg: '#08080f',
    bgImg:
      'radial-gradient(ellipse at 20% 50%,rgba(180,0,0,0.18),transparent 55%),radial-gradient(ellipse at 80% 30%,rgba(100,0,170,0.15),transparent 50%),repeating-linear-gradient(90deg,transparent,transparent 49px,rgba(200,200,255,0.02) 49px,rgba(200,200,255,0.02) 50px)',
    primary: '#cc2222',
    accent: '#4488ff',
    text: '#ffcccc',
    cardBg: 'rgba(15,5,5,0.9)',
    cardBorder: '2px solid #cc2222',
    btnBg: '#881111',
    btnBorder: 'none',
    btnShadow: '0 5px 0 #440000,0 0 25px rgba(204,34,34,0.4)',
    navBg: '#050005',
    nav: [
      { l: 'AUTOBOTS', i: 'tf_autobot' },
      { l: 'DECEPTICONS', i: 'tf_decepticon' },
      { l: 'ROBOTS', i: 'tf_robot' },
      { l: 'ROLL OUT', i: 'tf_truck' },
      { l: 'ENERGON', i: 'tf_energon' },
    ],
    floats: ['🤖', '⚡', '🔴', '🟣', '✨'],
  },

  // ─── RETRO ANIME (continued) ───────────────────────────────────────────────
  fma: {
    id: 'fma',
    name: 'Fullmetal Alchemist',
    group: 'anime',
    font: "'Press Start 2P',monospace",
    bg: '#1a0f00',
    bgImg:
      'radial-gradient(ellipse at 20% 80%,rgba(180,60,0,0.25),transparent 50%),radial-gradient(ellipse at 80% 20%,rgba(200,140,0,0.2),transparent 50%)',
    primary: '#cc4400',
    accent: '#ffaa00',
    text: '#ffcc99',
    cardBg: 'rgba(30,15,0,0.9)',
    cardBorder: '2px solid #cc4400',
    btnBg: '#cc4400',
    btnBorder: 'none',
    btnShadow: '0 5px 0 #662200,0 0 20px rgba(204,68,0,0.4)',
    navBg: '#0d0500',
    nav: [
      { l: 'ALCHEMY', i: 'fma_home' },
      { l: 'AUTO MAIL', i: 'fma_arm' },
      { l: 'ARRAY', i: 'fma_array' },
      { l: 'FLAME', i: 'fma_flame' },
      { l: 'THE GATE', i: 'fma_gate' },
    ],
    floats: ['⚗️', '🔥', '⚙️', '✨', '🩸'],
  },
};
