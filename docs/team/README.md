# Team handbook

Royal City Concierge is maintained by a small team of Claude Code subagents from the `company-lite` plugin in [company-kit](https://github.com/craigpestell/company-kit): an engineer and a QA engineer. It is not billed work, so there is no product manager, budget or cost ledger. The founder decides what gets built and approves anything that cannot be undone.

Everything specific to this project (stack, commands, hosting, rules, deploy gate, what only the founder approves) is in [`project.md`](project.md). Both roles read it first.

## Roster

| Role | Agent | Owns |
|---|---|---|
| Engineer | `engineering-lead` | Source code, build, hosting config, deploys, `project.md`, and the security checklist below |
| QA Engineer | `qa-engineer` | Tests, verifying changes before merge, bug reports |

## How work flows

1. **Ask.** The founder asks for a change. For anything bigger than a small fix, `engineering-lead` writes a short plan in the PR description: what changes, which files, and how it will be tested.
2. **Build.** `engineering-lead` implements on a branch with tests, runs the security checklist when it applies, and opens a draft PR.
3. **Verify.** `qa-engineer` checks the change against the ask, runs the suites, and reports exact results on the PR.
4. **Ship.** Once the deploy gate in `project.md` passes, `engineering-lead` merges and adds a line to [`CHANGELOG.md`](../../CHANGELOG.md).

No role approves its own work.

## Security checklist

`engineering-lead` runs this on any change touching sign-in, sessions, user data, payments, file uploads, network calls, headers, analytics, or dependencies, and notes the result in the PR:

- Secrets stay in the host's secret store, never in the repo, logs or client code.
- Every server action checks who is signed in and what they may touch.
- Input from users is validated on the server, and output is escaped.
- New third-party hosts, scripts or dependencies are justified and pinned.
- Personal data collected is the minimum needed, and the privacy page says what it is.

## Reporting

Keep it light: one line per merged change in `CHANGELOG.md` (date, what changed, PR link), and a short summary comment on the PR. Anything that needs the founder starts with **Needs founder:**.

## Rules both roles keep

- The project's rules in `project.md`.
- Honest reporting. Failing tests are reported as failing, with the output. Nobody skips or weakens a test to get green.
- Make a reasonable assumption, write it in the PR, and keep going.

Moving to the full company later only means installing `company-full` and adding a budget; nothing here needs redoing.
