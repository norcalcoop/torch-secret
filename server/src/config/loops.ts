import { LoopsClient } from 'loops';
import { env } from './env.js';

/**
 * Loops.so SDK singleton.
 *
 * Initialized once at import time. Uses the validated LOOPS_API_KEY from env.ts.
 * Import this singleton in services; never create a new LoopsClient() elsewhere.
 */
export const loops = new LoopsClient(env.LOOPS_API_KEY);
