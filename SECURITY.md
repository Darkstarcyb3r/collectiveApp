# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.3.x   | Yes                |
| < 1.3   | No                 |

## Reporting a Vulnerability

If you discover a security vulnerability in Collective App, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please email us at: **collective.app@proton.me**

Include the following in your report:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## What to Expect

- **Acknowledgment** of your report
- **Assessment** as soon as possible
- **Fix timeline** communicated after assessment
- **Credit** in the release notes (unless you prefer to remain anonymous)

## Scope

The following are in scope:

- The Collective App mobile application (React Native/Expo)
- Firebase Cloud Functions in the `functions/` directory
- Firestore security rules
- Authentication and authorization flows

The following are out of scope:

- Third-party services (Firebase, Cloudinary, Expo)
- Vulnerabilities in dependencies (please report these to the upstream maintainer)
- Social engineering attacks

## Security Best Practices for Contributors

- Never commit secrets, API keys, or credentials to the repository
- Use environment variables (`.env` files) for all sensitive configuration
- Keep `.env` files out of version control (they are gitignored)
- Follow the principle of least privilege in Firestore security rules
- Use server-signed uploads for Cloudinary (never expose API secrets client-side)

## Thank You

We appreciate the security research community's efforts in helping keep Collective App and its users safe.
