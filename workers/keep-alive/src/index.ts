/**
 * Torch Secret keep-alive Worker
 *
 * Pings the app health endpoint every 10 minutes to prevent Render.com free
 * tier spin-down (~60s cold starts). Fire-and-forget — no alerting, no state.
 *
 * Cloudflare Workers free tier limits:
 *   - 100,000 requests/day (this Worker makes 144 requests/day — well within limit)
 *   - 10ms CPU time per invocation (a single fetch() call is well within limit)
 *   - 5 cron triggers per account (this Worker uses 1)
 *
 * Source: https://developers.cloudflare.com/workers/examples/cron-trigger/
 */

const TARGET_URL = 'https://torchsecret.com/api/health';

export default {
  async scheduled(
    _controller: ScheduledController,
    _env: Record<string, never>,
    ctx: ExecutionContext,
  ): Promise<void> {
    // ctx.waitUntil() extends Worker lifetime until the fetch resolves.
    // Without it, the isolate may terminate before the fetch completes.
    ctx.waitUntil(
      fetch(TARGET_URL).catch(() => {
        // Fire-and-forget: keep-alive ping only — ignore errors.
        // Render cold starts are unpleasant but not catastrophic.
      }),
    );
  },
};
