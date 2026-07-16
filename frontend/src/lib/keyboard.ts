/** Returns true when a global shortcut would steal input from another control. */
export function isInteractiveKeyTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false

  return Boolean(target.closest([
    'a[href]',
    'button',
    'input',
    'select',
    'textarea',
    '[contenteditable="true"]',
    '[role="dialog"]',
    '[role="menu"]',
    '[role="menuitem"]',
    '[role="tab"]',
    '[role="radio"]',
  ].join(',')))
}
