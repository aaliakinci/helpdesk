export function selectNextRoundRobinMember(
  membershipIds: readonly string[],
  lastAssignedMembershipId: string | null,
): string | null {
  const candidates = [...new Set(membershipIds)].sort((left, right) => left.localeCompare(right));
  if (candidates.length === 0) return null;
  if (!lastAssignedMembershipId) return candidates[0] ?? null;
  const cursor = candidates.indexOf(lastAssignedMembershipId);
  return candidates[cursor < 0 || cursor === candidates.length - 1 ? 0 : cursor + 1] ?? null;
}
