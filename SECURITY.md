# Security Policy

## Supported Versions

| Version | Supported        |
| ------- | ---------------- |
| 3.x     | Yes              |
| 2.x     | No (end of life) |
| 1.x     | No (end of life) |

## Reporting a Vulnerability

If you discover a security vulnerability in SecureShare, please report it responsibly. **Do not** create a public GitHub issue.

**Preferred method:** Use GitHub's private vulnerability reporting:

[Report a vulnerability](https://github.com/norcalcoop/secureshare/security/advisories/new)

When reporting, please include:

- A description of the vulnerability
- Steps to reproduce the issue
- The potential impact or severity
- Any suggested fixes (if applicable)

**Response time:** We aim to acknowledge reports within 48 hours and will work with you to understand and address the issue promptly.

## Security Model

SecureShare uses a **zero-knowledge architecture**. The server never has access to plaintext secrets or encryption keys. All encryption and decryption happens exclusively in the browser using the Web Crypto API (AES-256-GCM). The encryption key is carried in the URL fragment (`#key`), which is never sent to the server per the HTTP specification.

A full database compromise reveals only encrypted ciphertext -- without the keys that exist only in shared URLs.

For more details on the architecture and security boundaries, see the [README](README.md).

## Disclosure Policy

We follow a coordinated disclosure process:

1. Reporter submits vulnerability via private advisory
2. We acknowledge within 48 hours
3. We investigate and develop a fix
4. We release the fix and publicly disclose the advisory
5. Reporter is credited (unless they prefer anonymity)

Thank you for helping keep SecureShare and its users safe.
