export function voiceNow(): string {
  return new Date().toISOString();
}

export function voiceLog(event: string, extra: Record<string, unknown> = {}): void {
  const line = {
    tag: '[VOICE]',
    ts: voiceNow(),
    event,
    ...extra,
  };
  console.log(`${line.tag} ${event}`, line);
}
