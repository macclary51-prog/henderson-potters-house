import assert from "node:assert/strict";
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

const pages = [
  "announcements.html",
  "connect.html",
  "events.html",
  "giving.html",
  "index.html",
  "ministries.html",
  "prayer.html",
  "sermons.html",
  "services.html",
  "staff-dashboard.html",
  "staff-login.html"
];


function pageSource(page) {
  return readFileSync(
    resolve(projectRoot, page),
    "utf8"
  );
}


for (const page of pages) {
  const source = pageSource(page);

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

  const inlineScripts = [
    ...source.matchAll(
      /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
    )
  ].filter(function (match) {
    return !/\bsrc\s*=/i.test(match[1])
      && match[2].trim();
  });

  assert.equal(
    inlineScripts.length,
    0,
    `${page} contains executable inline JavaScript that the CSP will block.`
  );

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
}


const accountPages = [
  ...pages,
  "public-content.js",
  "staff-dashboard.js"
];

for (const file of accountPages) {
  const source = readFileSync(
    resolve(projectRoot, file),
    "utf8"
  );

  assert.doesNotMatch(
    source,
    /minlength="6"|at least 6 characters/i,
    `${file} still permits a six-character staff password.`
  );
}


console.log(
  "Static HTML and security integrity tests passed."
);
