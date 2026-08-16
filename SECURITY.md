# Website Security

## Firestore access model

- Public visitors may read the church's published content.
- Public visitors may create only schema-validated prayer requests that start with the expected status, source, and server timestamp.
- Active Pastor and Ministry staff may manage announcements, events, services, sermons, and ministries.
- Only an active Pastor may manage staff access, giving settings, Connect links, and homepage highlights.
- Only active staff may read or delete prayer requests.
- All other Firestore paths are denied by default.

The authoritative policy is versioned in `firestore.rules`. Browser-side role checks are interface controls only and must never replace these rules.

## Test and deploy Firestore rules

Run the local regression suite before every rules deployment:

```powershell
$env:JAVA_HOME='C:\path\to\jdk'
$env:PATH="$env:JAVA_HOME\bin;$env:PATH"
firebase emulators:exec --only auth,firestore --project demo-henderson-security "node tests/firestore-rules.test.mjs"
```

Then deploy only the reviewed Firestore policy:

```powershell
firebase deploy --only firestore:rules --project hendersonpottershouse-aa92d
```

The static integrity test is:

```powershell
node tests/static-integrity.test.mjs
```

## Firebase Console hardening still required

The static site cannot provide these controls by itself:

1. Replace browser-side staff account creation with a Pastor-authorized trusted backend using the Firebase Admin SDK. Disable unrestricted client self-registration when that workflow is ready.
2. Protect public prayer submissions with App Check or a bot challenge plus a server-enforced rate limit. Keep the current Firestore field validation as an additional layer.
3. Enable a matching Firebase Authentication password policy and multi-factor authentication for the Pastor account. The website currently enforces 12–128 characters with uppercase, lowercase, and numeric characters, but the server policy must enforce the same standard.
4. Monitor Authentication for orphan accounts and Firestore usage for unusual prayer-request write volume.

Do not commit service-account files, private keys, passwords, or Firebase administrative credentials.

## Browser policy

Each public and staff page includes a compatible Content Security Policy and a strict referrer policy. Because GitHub Pages does not provide repository-configurable response headers, clickjacking protection such as `frame-ancestors` must be added at a CDN or host that supports custom HTTP headers.
