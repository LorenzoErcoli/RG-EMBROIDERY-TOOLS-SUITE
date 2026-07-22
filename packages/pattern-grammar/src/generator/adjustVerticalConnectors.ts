import type { GeneratedPoint } from "../grammar/types.ts";

/**
 * Moves only the shared endpoints between consecutive vertical blocks.
 * Internal vertical zig-zag geometry remains unchanged.
 */
export function adjustVerticalConnectorDiagonals(
  blocks: GeneratedPoint[][],
  offsetY = 0
): GeneratedPoint[][] {
  const adjusted = blocks.map((block) => block.map((point) => ({ ...point })));
  if (offsetY === 0) return adjusted;
  for (let index = 0; index < adjusted.length - 1; index++) {
    const current = adjusted[index];
    const next = adjusted[index + 1];
    current[current.length - 1].y -= offsetY / 2;
    next[0].y += offsetY / 2;
  }
  return adjusted;
}
