import assert from "node:assert/strict";
import {
  createHash
} from "node:crypto";
import {
  existsSync,
  readFileSync
} from "node:fs";
import {
  dirname,
  resolve
} from "node:path";
import {
  fileURLToPath
} from "node:url";


const projectRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  ".."
);

const publicPages = {
  "index.html": "https://www.hendersonpotterhouse.com/",
  "announcements.html": "https://www.hendersonpotterhouse.com/announcements.html",
  "events.html": "https://www.hendersonpotterhouse.com/events.html",
  "services.html": "https://www.hendersonpotterhouse.com/services.html",
  "ministries.html": "https://www.hendersonpotterhouse.com/ministries.html",
  "sermons.html": "https://www.hendersonpotterhouse.com/sermons.html",
  "giving.html": "https://www.hendersonpotterhouse.com/giving.html",
  "connect.html": "https://www.hendersonpotterhouse.com/connect.html",
  "prayer.html": "https://www.hendersonpotterhouse.com/prayer.html",
  "contact.html": "https://www.hendersonpotterhouse.com/contact.html",
  "privacy.html": "https://www.hendersonpotterhouse.com/privacy.html"
};

const supportingPages = [
  "404.html",
  "staff-dashboard.html",
  "staff-login.html"
];

const pages = [
  ...Object.keys(publicPages),
  ...supportingPages
];

const expectedNavigation = [
  "index.html",
  "announcements.html",
  "events.html",
  "services.html",
  "ministries.html",
  "sermons.html",
  "giving.html",
  "connect.html",
  "prayer.html",
  "contact.html",
  "staff-login.html"
];

const activePage = {
  "index.html": "index.html",
  "announcements.html": "announcements.html",
  "events.html": "events.html",
  "services.html": "services.html",
  "ministries.html": "ministries.html",
  "sermons.html": "sermons.html",
  "giving.html": "giving.html",
  "connect.html": "connect.html",
  "prayer.html": "prayer.html",
  "contact.html": "contact.html",
  "staff-login.html": "staff-login.html",
  "staff-dashboard.html": "staff-login.html"
};


function sourceFor(file) {
  return readFileSync(
    resolve(projectRoot, file),
    "utf8"
  );
}


function primaryNavigation(source) {
  const match = source.match(
    /<nav\b[^>]*\bid="navLinks"[^>]*>([\s\S]*?)<\/nav>/i
  );

  assert.ok(match, "Page is missing #navLinks.");

  return match[1];
}


for (const page of pages) {
  const source = sourceFor(page);

  assert.match(
    source,
    /http-equiv="Content-Security-Policy"/i,
    `${page} must include the site Content Security Policy.`
  );

  assert.match(
    source,
    /<meta\s+name="referrer"\s+content="strict-origin-when-cross-origin">/i,
    `${page} must include the strict referrer policy.`
  );

  assert.match(
    source,
    /<noscript>\s*<link\s+rel="stylesheet"\s+href="noscript\.css">\s*<\/noscript>/i,
    `${page} must preserve navigation when JavaScript is disabled.`
  );

  const inlineScripts = [
    ...source.matchAll(
      /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
    )
  ].filter(function (match) {
    return !/\bsrc\s*=/i.test(match[1])
      && !/\btype\s*=\s*"application\/ld\+json"/i.test(match[1])
      && match[2].trim();
  });

  assert.equal(
    inlineScripts.length,
    0,
    `${page} contains executable inline JavaScript that the CSP will block.`
  );

  for (const schemaMatch of source.matchAll(
    /<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
  )) {
    assert.doesNotThrow(
      function () {
        JSON.parse(schemaMatch[1]);
      },
      `${page} contains invalid JSON-LD.`
    );
  }

  const ids = [
    ...source.matchAll(/\bid="([^"]+)"/gi)
  ].map(function (match) {
    return match[1];
  });

  const duplicateIds = ids.filter(
    function (id, index) {
      return ids.indexOf(id) !== index;
    }
  );

  assert.deepEqual(
    [...new Set(duplicateIds)],
    [],
    `${page} contains duplicate element IDs.`
  );

  const assetReferences = [
    ...source.matchAll(/\b(?:href|src)="([^"]+)"/gi)
  ].map(function (match) {
    return match[1];
  });

  for (const reference of assetReferences) {
    if (
      reference.startsWith("#")
      || reference.startsWith("//")
      || reference.startsWith("/")
      || /^[a-z][a-z0-9+.-]*:/i.test(reference)
    ) {
      continue;
    }

    const localPath = decodeURIComponent(
      reference.split(/[?#]/, 1)[0]
    );

    if (!localPath) {
      continue;
    }

    assert.ok(
      existsSync(resolve(projectRoot, localPath)),
      `${page} references missing local asset ${reference}.`
    );
  }

  for (const tagMatch of source.matchAll(
    /<(?:a|area)\b[^>]*target="_blank"[^>]*>/gi
  )) {
    assert.match(
      tagMatch[0],
      /rel="[^"]*noopener[^"]*noreferrer[^"]*"/i,
      `${page} has a target=_blank link without noopener noreferrer.`
    );
  }

  const navigation = primaryNavigation(source);
  const navigationHrefs = [
    ...navigation.matchAll(/\bhref="([^"]+)"/gi)
  ].map(function (match) {
    return match[1];
  });

  assert.deepEqual(
    navigationHrefs,
    expectedNavigation,
    `${page} must contain the complete raw navigation in the correct order.`
  );

  const currentHref = activePage[page];
  const currentMatches = [
    ...navigation.matchAll(
      /<a\b([^>]*)>/gi
    )
  ].filter(function (match) {
    return /\bclass="[^"]*\bactive\b/i.test(match[1]);
  });

  if (currentHref) {
    assert.equal(
      currentMatches.length,
      1,
      `${page} must have exactly one active navigation link.`
    );

    assert.match(
      currentMatches[0][1],
      new RegExp(`href="${currentHref.replace(".", "\\.")}"`, "i"),
      `${page} marks the wrong navigation link active.`
    );

    assert.match(
      currentMatches[0][1],
      /aria-current="page"/i,
      `${page} active navigation must use aria-current=page.`
    );
  } else {
    assert.equal(
      currentMatches.length,
      0,
      `${page} must not mark an unrelated primary navigation item active.`
    );
  }

  assert.match(
    source,
    /©\s*2026\s+The Henderson Potter's House/i,
    `${page} must contain the literal 2026 copyright.`
  );

  assert.doesNotMatch(
    source,
    /id="year"/i,
    `${page} still depends on JavaScript for the copyright year.`
  );
}


for (const [page, canonical] of Object.entries(publicPages)) {
  const source = sourceFor(page);

  const description = source.match(
    /<meta\s+name="description"\s+content="([^"]+)"/i
  )?.[1] || source.match(
    /<meta\s+name="description"[\s\S]*?content="([^"]+)"/i
  )?.[1] || "";

  assert.ok(
    description.length >= 80,
    `${page} needs a useful unique meta description.`
  );

  assert.match(
    source,
    new RegExp(`<link\\s+rel="canonical"\\s+href="${canonical.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}">`, "i"),
    `${page} has the wrong canonical URL.`
  );

  for (const required of [
    "og:title",
    "og:description",
    "og:type",
    "og:url",
    "og:image",
    "og:site_name",
    "twitter:card",
    "twitter:title",
    "twitter:description",
    "twitter:image"
  ]) {
    assert.match(
      source,
      new RegExp(`(?:property|name)="${required}"`, "i"),
      `${page} is missing ${required}.`
    );
  }

  assert.match(
    source,
    /href="favicon\.ico"/i,
    `${page} is missing favicon.ico.`
  );

  assert.match(
    source,
    /rel="apple-touch-icon"/i,
    `${page} is missing the Apple touch icon.`
  );

  assert.match(
    source,
    /rel="manifest"\s+href="site\.webmanifest"/i,
    `${page} is missing the web manifest.`
  );

  assert.match(
    source,
    /type="application\/ld\+json"/i,
    `${page} must include hardcoded JSON-LD.`
  );
}


for (const page of [
  "staff-dashboard.html",
  "staff-login.html"
]) {
  assert.match(
    sourceFor(page),
    /<meta\s+name="robots"\s+content="noindex,\s*nofollow">/i,
    `${page} must be noindex, nofollow.`
  );
}


for (const page of [
  "announcements.html",
  "events.html",
  "services.html",
  "ministries.html",
  "sermons.html"
]) {
  const source = sourceFor(page);

  assert.doesNotMatch(
    source,
    /staffInlineAccountsModal|Create Ministry Account|Temporary password/i,
    `${page} ships privileged account-management markup to public visitors.`
  );
}


for (const page of Object.keys(publicPages)) {
  assert.doesNotMatch(
    sourceFor(page),
    /Loading (?:church information|services|service times|homepage information|church links)/i,
    `${page} can remain stuck on a public Loading message without JavaScript.`
  );
}


assert.doesNotMatch(
  sourceFor("contact.html"),
  /mailto:|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  "Contact page must not invent a church email address."
);

assert.match(
  sourceFor("contact.html"),
  /Pastor William Rice/,
  "Contact page must identify Pastor William Rice."
);

assert.match(
  sourceFor("index.html"),
  /Pastor William Rice/,
  "Homepage must identify Pastor William Rice."
);

for (const file of [
  "app-version.json",
  "apple-touch-icon.png",
  "favicon-16x16.png",
  "favicon-32x32.png",
  "favicon-192x192.png",
  "favicon-512x512.png",
  "favicon.ico",
  "llms.txt",
  "robots.txt",
  "site.webmanifest",
  "sitemap.xml"
]) {
  assert.ok(
    existsSync(resolve(projectRoot, file)),
    `${file} is required.`
  );
}

const pngSignature = Buffer.from([
  0x89, 0x50, 0x4e, 0x47,
  0x0d, 0x0a, 0x1a, 0x0a
]);

assert.deepEqual(
  readFileSync(resolve(projectRoot, "church_logo.png")).subarray(0, 8),
  pngSignature,
  "church_logo.png must contain real PNG data."
);

assert.deepEqual(
  readFileSync(resolve(projectRoot, "favicon-512x512.png")).subarray(0, 8),
  pngSignature,
  "favicon-512x512.png must contain real PNG data."
);

const appVersion = JSON.parse(
  sourceFor("app-version.json")
);

assert.equal(appVersion.version, "1.0.0");
assert.equal(appVersion.versionCode, 1);
assert.equal(appVersion.packageName, "com.ldg.hendersonpottershouse");
assert.equal(appVersion.minimumSdk, 24);

const apkHash = createHash("sha256")
  .update(
    readFileSync(
      resolve(
        projectRoot,
        "downloads/henderson-potters-house.apk"
      )
    )
  )
  .digest("hex")
  .toUpperCase();

assert.equal(
  apkHash,
  appVersion.sha256,
  "app-version.json SHA-256 must match the APK."
);

const robots = sourceFor("robots.txt");
assert.match(robots, /^User-agent:\s*\*$/m);
assert.match(robots, /^Allow:\s*\/$/m);
assert.match(robots, /Disallow:\s*\/staff-login\.html/);
assert.match(robots, /Disallow:\s*\/staff-dashboard\.html/);
assert.match(robots, /Sitemap:\s*https:\/\/www\.hendersonpotterhouse\.com\/sitemap\.xml/);

const sitemap = sourceFor("sitemap.xml");
for (const canonical of Object.values(publicPages)) {
  assert.match(
    sitemap,
    new RegExp(
      `<loc>${canonical.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}<\\/loc>`
    ),
    `sitemap.xml is missing ${canonical}.`
  );
}

assert.doesNotMatch(
  sitemap,
  /staff-(?:login|dashboard)\.html|404\.html/,
  "sitemap.xml must not list staff or error pages."
);


console.log(
  "Static HTML, metadata, app, and security integrity tests passed."
);
