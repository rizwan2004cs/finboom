import type { Asset, Goal } from "@/lib/types"

/**
 * Amount a goal is currently funded by.
 *
 * If the goal has linked assets, sum those assets' current value; otherwise fall
 * back to the manually-tracked `current_amount`. This mirrors the logic used by
 * the Wealth Check so goal progress is consistent everywhere it's shown.
 */
export function goalFundedAmount(goal: Goal, assets: Asset[]): number {
  if (goal.linked_assets?.length) {
    const byId = new Map(assets.map((a) => [a.id, Number(a.current_value)]))
    return goal.linked_assets.reduce((sum, id) => sum + (byId.get(id) ?? 0), 0)
  }
  return Number(goal.current_amount || 0)
}

/** Goal progress as a percentage (0+). Returns 0 when the target is not positive. */
export function goalProgressPct(goal: Goal, assets: Asset[]): number {
  const target = Number(goal.target_amount)
  if (target <= 0) return 0
  return (goalFundedAmount(goal, assets) / target) * 100
}
