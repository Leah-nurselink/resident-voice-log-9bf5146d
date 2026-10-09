<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project architecture decisions

- Shared authenticated pages use `AppShell` for phone-safe headers, action wrapping, and horizontal overflow containment so each page does not reinvent mobile framing.
- The resident calendar reads existing schedules and review records through an authenticated server function with Query-backed loading; URL search stores month, selected date and filters so navigation remains shareable without duplicating resident records.
- The rota is service-scoped: every rota screen follows a selected row from the `services` table, whose `service_type` (domiciliary vs care_home) decides which rota UI and rules apply — the setting belongs to the service, never the account.
- Pre-admission assessments are versioned rows whose question definitions live in code and are tagged to care-plan domains, so care plans and AI drafts read signed-off answers per domain without duplicating fields.
