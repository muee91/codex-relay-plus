export function bindThreadQuery<T>(queryFn: (threadId: string) => Promise<T>, threadId: string) {
  return () => queryFn(threadId);
}
