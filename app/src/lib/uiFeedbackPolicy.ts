/** A tab-switch effect belongs to successful navigation, not the press itself. */
export function shouldTriggerTabSwitchFeedback(
  focused: boolean,
  defaultPrevented: boolean,
): boolean {
  return !focused && !defaultPrevented;
}
