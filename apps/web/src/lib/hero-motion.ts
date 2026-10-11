const cameraPoints = [
  { x: 0, y: 0, scale: 1 },
  { x: 13, y: 8, scale: 1.34 },
  { x: -3, y: -1, scale: 1.48 },
  { x: -18, y: -8, scale: 1.36 },
] as const;

function clampProgress(value: number): number {
  return Number.isNaN(value) ? 0 : Math.min(Math.max(value, 0), 1);
}

/** Measure against the sticky frame, not the changing mobile browser chrome height. */
export function heroScrollProgress(sectionTop: number, sectionHeight: number, frameHeight: number) {
  return clampProgress(-sectionTop / Math.max(sectionHeight - frameHeight, 1));
}

export function heroMotionFrame(progress: number) {
  const ratio = clampProgress(progress);
  const position = ratio * (cameraPoints.length - 1);
  const segment = Math.min(Math.floor(position), cameraPoints.length - 2);
  const localProgress = position - segment;
  const eased = localProgress * localProgress * (3 - 2 * localProgress);
  const from = cameraPoints[segment];
  const to = cameraPoints[segment + 1];
  return {
    ratio,
    scene: Math.min(Math.round(position), cameraPoints.length - 1),
    x: from.x + (to.x - from.x) * eased,
    y: from.y + (to.y - from.y) * eased,
    scale: from.scale + (to.scale - from.scale) * eased,
  };
}
