export function calculateDamage(attackStat, defenseStat) {
  return Math.max(1, (attackStat ?? 0) - (defenseStat ?? 0));
}
