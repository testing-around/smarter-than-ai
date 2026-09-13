export function createQuestionSessionId(questionId: string): string {
  return `${questionId}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

export function isLiveSession(eventSessionId: string, currentSessionId: string): boolean {
  return Boolean(eventSessionId) && eventSessionId === currentSessionId;
}
