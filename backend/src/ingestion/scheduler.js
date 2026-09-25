/** Interval job runner with an overlap guard (PRD §13.2 "scheduled collectors/workers"). */
export function startScheduler({ run, intervalMs, logger = console, runImmediately = false }) {
  let running = false;
  const tick = async () => {
    if (running) {
      logger.warn?.('previous ingestion still running — skipping this tick');
      return;
    }
    running = true;
    try {
      await run();
    } catch (err) {
      logger.error?.(err, 'scheduled ingestion failed');
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  if (runImmediately) tick();
  return { stop: () => clearInterval(timer), tick };
}
