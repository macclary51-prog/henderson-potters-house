# Website launch and security checklist

This file records the setup that cannot be completed safely from this static
GitHub Pages repository alone. Firestore remains the source of truth for church
content. The raw HTML contains useful, non-record fallback information, and the
Firebase JavaScript replaces or enhances it with the current Firestore snapshot.

## Firebase Authentication password policy

Before issuing new ministry accounts, open Firebase Console and go to
Authentication > Settings > Password policy. Set the policy to **Require** with:

- minimum length: 12
- maximum length: 128
- lowercase character required
- uppercase character required
- numeric character required

Do not force-upgrade existing accounts until Pastor William Rice and every
ministry user have confirmed recovery-email access. The website validates this
policy, but Firebase must enforce it so password-reset flows cannot accept weaker
passwords.

The static website cannot securely prove that a first-login password change took
place. New account provisioning therefore creates a random bootstrap password
and sends Firebase's password-reset email. The bootstrap password is not shown or
stored. The pastor can resend a reset link if it expires.

## Firebase App Check

App Check is compatible with a static web client, but it must not be enforced
until every Firebase client is instrumented, including the Android app.

1. Register the web app with reCAPTCHA Enterprise in Firebase App Check.
2. Add the issued public site key to the web initialization and allow only the
   required reCAPTCHA origins in the CSP.
3. Add an Android App Check provider to the Android application and release the
   updated APK.
4. Deploy both clients with enforcement disabled and monitor App Check metrics.
5. After legitimate traffic is verified, enforce App Check for Cloud Firestore
   and Firebase Authentication.

App Check reduces automated abuse but is not an IP-based rate limiter. Stronger
prayer-request throttling and pastor-only Auth user creation require a trusted
backend, such as a callable Cloud Function using the Admin SDK. Firestore rules
must remain in place even after adding either control.

Official guidance:

- https://firebase.google.com/docs/app-check/web/recaptcha-provider
- https://firebase.google.com/docs/app-check/monitor-metrics

## HTTP security headers

The repository uses a meta Content Security Policy for directives supported in
HTML. GitHub Pages does not provide repository-controlled custom response
headers. The live custom domain currently does not return HSTS, response-level
CSP, X-Frame-Options, Permissions-Policy, or X-Content-Type-Options.

To enforce `frame-ancestors`, HSTS, and the remaining response headers, put a
configured CDN or reverse proxy in front of GitHub Pages, or move to a host that
supports custom headers. Do not add `frame-ancestors` to the meta CSP and claim
clickjacking protection; browsers ignore that directive in a meta policy.

## Error reporting and privacy

The site keeps visitor-facing messages general and writes technical failures to
the browser console. If a production error service is added, configure explicit
allowlisted events and redact all request payloads. Never send prayer text,
prayer contact details, staff email addresses, passwords, Firebase ID/access
tokens, or authentication headers to analytics or error reporting. Google
Analytics must not receive prayer-request contents.

## Search and webmaster accounts

- Preserve `google8a24f642ea2267ac.html`.
- Submit `https://www.hendersonpotterhouse.com/sitemap.xml` in Google Search
  Console.
- Add the site in Bing Webmaster Tools, then place Bing's real verification token
  or file in the repository. No Bing token is included because none is verified.
- Review the contact, privacy, and church profile information before requesting
  indexing.

## Android release

`app-version.json` is the maintainable source for the website's displayed APK
metadata. Update it whenever the binary changes, then verify the APK with Android
build tools and update the SHA-256 value.

The current APK is version 1.0.0 (build 1), package
`com.ldg.hendersonpottershouse`, and supports Android 7.0/API 24 or newer. It is
signed with an Android Debug certificate. Replace it with a release-signed APK
before broad public distribution, keep the release key secure, and retain the
same release key for future updates. Do not resign the current binary in place.

## Church review still required

- final service days and times
- Pastor William Rice biography, if the church wants one
- a church email address, if the church wants one published
- privacy-policy approval and a retention process for prayer requests
- any 501(c)(3) or EIN display decision
- final photographs and any additional official social links
