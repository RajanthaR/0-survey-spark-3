export type SlideNavigationAction = "next" | "prev" | "first" | "last";

export function clampSlideIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(Math.max(index, 0), total - 1);
}

export function slideHash(index: number): string {
  return `#slide-${index + 1}`;
}

export function parseSlideHash(hash: string, total: number): number {
  const match = hash.match(/^#slide-(\d+)$/);
  if (!match) return 0;
  return clampSlideIndex(Number(match[1]) - 1, total);
}

export function moveSlideIndex(
  index: number,
  total: number,
  action: SlideNavigationAction,
): number {
  if (action === "first") return 0;
  if (action === "last") return clampSlideIndex(total - 1, total);
  if (action === "next") return clampSlideIndex(index + 1, total);
  return clampSlideIndex(index - 1, total);
}
