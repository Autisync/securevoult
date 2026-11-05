/** Runs once when the server starts: begins the background security checks. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NEXT_PHASE === 'phase-production-build') return;
  if (!process.env.MONGODB_URI) return;
  const { startJobs } = await import('@/lib/jobs');
  startJobs();
}
