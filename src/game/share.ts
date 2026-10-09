/** Share text for the daily puzzle. Deliberately contains no account identifiers. */
export function buildDailyShareText(date: string, isCorrect: boolean, streak: number): string {
  const lines = [
    `Tennis IQ Daily Puzzle ${date} (UTC)`,
    isCorrect ? 'Solved it on court.' : 'Learned something new today.',
  ];
  if (streak > 1) lines.push(`Daily streak: ${streak} days`);
  return lines.join('\n');
}
