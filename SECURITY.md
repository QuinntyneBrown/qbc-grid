# Security policy

## Reporting a vulnerability

Please report suspected vulnerabilities privately to the maintainer at
[quinntynebrown@gmail.com](mailto:quinntynebrown@gmail.com), using the subject
`[qbc-grid security]`.

If GitHub offers **Report a vulnerability** on this repository's
[Security tab](https://github.com/QuinntyneBrown/qbc-grid/security), you may use that private
channel instead. Do not post exploit details or sensitive information in a public issue.

Include the affected revision or package version, a minimal reproduction, the impact,
and any suggested mitigation. Remove credentials and personal data from attachments.
The maintainer will assess the report and coordinate a fix and disclosure with you.
There is no guaranteed response time or paid bounty program.

## Supported code

Security fixes target the current `main` branch. There is no long-term-support or
backport commitment for earlier revisions or package versions. Check the
[changelog](CHANGELOG.md) and repository security advisories for published fixes.

## Security boundaries

qbc-grid is a client-side Angular library. It accepts layout data and projects content
provided by the host application. Layout normalization is a geometry repair mechanism;
it is not an authorization boundary or a substitute for validating application data.

The host owns authentication, authorization, storage, widget content, and its content
security policy. Avoid rendering untrusted strings as HTML in projected widgets. Never
store secrets in demonstration layouts or browser local storage.

For ordinary defects and usage questions, use [SUPPORT.md](SUPPORT.md).
