# Issue tracker: GitHub

Issues and specs live in GitHub Issues for `zanellig/reservas-clases-ia`.
Use the `gh` CLI from this clone.

## Conventions

- Create: `gh issue create --title "..." --body-file <path>`.
- Read: `gh issue view <number> --json number,title,body,labels,comments`.
- List: `gh issue list --state open --json number,title,body,labels,comments`.
  Add label filters as needed.
- Comment: `gh issue comment <number> --body-file <path>`.
- Apply or remove labels: `gh issue edit <number> --add-label "..."`,
  or `--remove-label "..."`.
- Close: `gh issue close <number>`.

For multiline bodies, write the exact Markdown to a temporary file and
pass it with `--body-file`. Follow the repository's disclosure rules for
issues, pull requests, reviews, and comments.

Infer the repository from the Git remote.

## Parent issues and dependencies

Create a child with `gh issue create --parent <parent> ...`, or attach
an existing issue with `gh issue edit <parent> --add-sub-issue <child>`.
If sub-issues are unavailable, put `Part of #<parent>` at the top of
the child body and link it in the parent's task list.

Use GitHub's native issue dependencies for blocking relationships:

`gh api --method POST repos/{owner}/{repo}/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`

Get the database ID with
`gh api repos/{owner}/{repo}/issues/<number> --jq .id`.
Use the numeric database ID, not the issue number or node ID.
If dependencies are unavailable, put `Blocked by: #<number>` at the top
of the child body. An issue is unblocked when every blocker is closed.

## Pull requests as a triage surface

**PRs as a request surface: no.**

## Skill operations

When a skill says "publish to the issue tracker", create a GitHub issue.
When it says "fetch the relevant ticket", read the GitHub issue.

For wayfinding, keep the map in one issue labelled `wayfinder:map`.
Link its tickets as sub-issues and label them `wayfinder:<type>`, where
type is `research`, `prototype`, `grilling`, or `task`.
Create these labels when that workflow is first used.

Choose the first open, unassigned child in map order whose blockers
are all closed. Claim it with `gh issue edit <number> --add-assignee @me`.
To resolve it, comment with the result, close the ticket, and append
a brief result and ticket link to the map's Decisions-so-far.
