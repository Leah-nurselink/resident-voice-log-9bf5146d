# Make CareCore mobile-friendly

## Goal
Make the existing CareCore screens fit and remain easy to use on phones without changing workflows, permissions, data, or BLE functionality.

## Changes
- Rework the shared top bar so the page title, menu, notifications, profile, and page actions never overflow. Secondary actions will wrap below the title or move into a compact phone action area.
- Keep the existing slide-out menu on phones, with larger touch targets and reliable closing after navigation.
- Remove horizontal page overflow and use phone-safe spacing throughout the shared page frame.
- Improve the Residents page first: stack download/add actions, keep summary tiles readable, make tabs and search fit, and ensure resident cards and the add-resident form use one column on narrow screens.
- Improve Resident Profile: stack the resident identity and action buttons, make the 13-section navigation horizontally scrollable instead of compressed, and keep forms/dialogs within the screen.
- Apply reusable phone rules to common tables, tab bars, forms, and action rows so other existing pages degrade safely rather than clipping.
- Preserve the current desktop and tablet layouts.

## Verification
- Check at 390 × 844 and a narrower 360px phone width.
- Confirm there is no page-level horizontal scrolling on Residents and Resident Profile.
- Confirm the menu, Add resident, resident cards, profile navigation, and dialogs remain usable by touch.
- Confirm the current build remains clean and no BLE files or behaviour change.

## Technical details
- Use the existing responsive utility classes and design tokens.
- Update the shared `AppShell` first, then focused resident list/detail layout classes and shared dialog/form rules.
- Keep fixed-size controls non-shrinking while allowing titles and supporting text to truncate or wrap.
