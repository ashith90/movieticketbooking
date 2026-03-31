# Branch Protection Recommendations

Apply these settings to your default branch (`main` or `master`):

## Required Pull Request Reviews
- Require at least 1 approving review.
- Dismiss stale reviews when new commits are pushed.
- Require review from code owners (optional but recommended).

## Required Status Checks
Mark these checks as required before merge:
- `PR Fast Checks / syntax-and-compose-smoke`
- `CI E2E / e2e`

## How to Configure in GitHub
1. Open your repository on GitHub.
2. Go to **Settings** -> **Branches**.
3. Under **Branch protection rules**, create or edit the rule for `main` (or `master`).
4. Enable **Require status checks to pass before merging**.
5. Select these required checks:
	- `PR Fast Checks / syntax-and-compose-smoke`
	- `CI E2E / e2e`
6. Enable **Require branches to be up to date before merging**.
7. Save changes.

Note: branch protection is enforced by GitHub repository settings, not by files in this repo.

## Additional Protections
- Require branches to be up to date before merging.
- Restrict force pushes.
- Restrict branch deletion.
- Require conversation resolution before merge.

## Optional Hardening
- Require signed commits.
- Restrict who can push to default branch.
- Enable merge queue for busy repos.
