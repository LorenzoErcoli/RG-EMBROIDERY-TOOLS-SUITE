import type { GeneratedPoint } from "../grammar/types.ts";

export type ColumnDirection = "topToBottom" | "bottomToTop";

/**
 * Changes traversal only. Coordinates and point roles are preserved exactly.
 */
export function orderColumnBlocks(
  blocks: GeneratedPoint[][],
  direction: ColumnDirection
): GeneratedPoint[] {
  const orderedBlocks = direction === "topToBottom" ? blocks : blocks.slice().reverse();
  return orderedBlocks.flatMap((block) =>
    direction === "topToBottom" ? block : block.slice().reverse()
  );
}

export function columnDirection(columnIndex: number, repeatBack = false): ColumnDirection {
  return repeatBack && columnIndex % 2 === 1 ? "bottomToTop" : "topToBottom";
}
