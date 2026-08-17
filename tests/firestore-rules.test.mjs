import assert from "node:assert/strict";


const projectId =
  process.env.GCLOUD_PROJECT ||
  "demo-henderson-security";

const firestoreHost =
  process.env.FIRESTORE_EMULATOR_HOST;

const authHost =
  process.env.FIREBASE_AUTH_EMULATOR_HOST;

assert.ok(
  firestoreHost,
  "FIRESTORE_EMULATOR_HOST is required."
);

assert.ok(
  authHost,
  "FIREBASE_AUTH_EMULATOR_HOST is required."
);


const firestoreBase =
  `http://${firestoreHost}/v1/projects/${projectId}/databases/(default)`;

const authBase =
  `http://${authHost}/identitytoolkit.googleapis.com/v1`;


function stringValue(value) {
  return {
    stringValue: String(value)
  };
}


function booleanValue(value) {
  return {
    booleanValue: Boolean(value)
  };
}


function integerValue(value) {
  return {
    integerValue: String(value)
  };
}


function timestampValue(value) {
  return {
    timestampValue: value
  };
}


async function requestJson(
  url,
  {
    method = "GET",
    token = "",
    body
  } = {}
) {
  const headers = {
    "Content-Type": "application/json"
  };

  if (token) {
    headers.Authorization =
      `Bearer ${token}`;
  }

  const response =
    await fetch(
      url,
      {
        method,
        headers,
        body:
          body === undefined
            ? undefined
            : JSON.stringify(body)
      }
    );

  const text =
    await response.text();

  let parsed = null;

  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  return {
    status: response.status,
    body: parsed
  };
}


function expectStatus(
  result,
  expected,
  label
) {
  assert.equal(
    result.status,
    expected,
    `${label}: expected ${expected}, received ${result.status}. ${JSON.stringify(result.body)}`
  );
}


async function createAuthUser(email) {
  const result =
    await requestJson(
      `${authBase}/accounts:signUp?key=fake-api-key`,
      {
        method: "POST",
        body: {
          email,
          password: "StrongTestPass123!",
          returnSecureToken: true
        }
      }
    );

  expectStatus(
    result,
    200,
    `Create Auth emulator user ${email}`
  );

  return {
    uid: result.body.localId,
    token: result.body.idToken
  };
}


async function adminSetDocument(
  path,
  fields
) {
  const result =
    await requestJson(
      `${firestoreBase}/documents/${path}`,
      {
        method: "PATCH",
        token: "owner",
        body: {
          fields
        }
      }
    );

  expectStatus(
    result,
    200,
    `Admin seed ${path}`
  );
}


async function commitCreate(
  path,
  fields,
  serverTimestampFields,
  token = ""
) {
  const result =
    await requestJson(
      `${firestoreBase}/documents:commit`,
      {
        method: "POST",
        token,
        body: {
          writes: [
            {
              update: {
                name:
                  `projects/${projectId}/databases/(default)/documents/${path}`,
                fields
              },
              updateTransforms:
                serverTimestampFields.map(
                  function (fieldPath) {
                    return {
                      fieldPath,
                      setToServerValue:
                        "REQUEST_TIME"
                    };
                  }
                ),
              currentDocument: {
                exists: false
              }
            }
          ]
        }
      }
    );

  return result;
}


async function commitUpdate(
  path,
  fields,
  fieldPaths,
  serverTimestampFields,
  token = ""
) {
  return requestJson(
    `${firestoreBase}/documents:commit`,
    {
      method: "POST",
      token,
      body: {
        writes: [
          {
            update: {
              name:
                `projects/${projectId}/databases/(default)/documents/${path}`,
              fields
            },
            updateMask: {
              fieldPaths
            },
            updateTransforms:
              serverTimestampFields.map(
                function (fieldPath) {
                  return {
                    fieldPath,
                    setToServerValue:
                      "REQUEST_TIME"
                  };
                }
              )
          }
        ]
      }
    }
  );
}


async function getDocument(
  path,
  token = ""
) {
  return requestJson(
    `${firestoreBase}/documents/${path}`,
    {
      token
    }
  );
}


async function deleteDocument(
  path,
  token = ""
) {
  return requestJson(
    `${firestoreBase}/documents/${path}`,
    {
      method: "DELETE",
      token
    }
  );
}


const pastor =
  await createAuthUser(
    "pastor@example.test"
  );

const ministry =
  await createAuthUser(
    "ministry@example.test"
  );

const inactive =
  await createAuthUser(
    "inactive@example.test"
  );

const authOnly =
  await createAuthUser(
    "auth-only@example.test"
  );

const invitedMinistry =
  await createAuthUser(
    "invited-ministry@example.test"
  );

const seedTime =
  "2026-01-01T00:00:00.000000Z";

await adminSetDocument(
  `staff/${pastor.uid}`,
  {
    name: stringValue("Pastor Test"),
    email: stringValue("pastor@example.test"),
    role: stringValue("pastor"),
    active: booleanValue(true),
    createdAt: timestampValue(seedTime),
    updatedAt: timestampValue(seedTime),
    createdBy: stringValue(pastor.uid),
    updatedBy: stringValue(pastor.uid)
  }
);

await adminSetDocument(
  `staff/${ministry.uid}`,
  {
    name: stringValue("Ministry Test"),
    email: stringValue("ministry@example.test"),
    role: stringValue("ministry"),
    active: booleanValue(true),
    createdAt: timestampValue(seedTime),
    updatedAt: timestampValue(seedTime),
    createdBy: stringValue(pastor.uid),
    updatedBy: stringValue(pastor.uid)
  }
);

await adminSetDocument(
  `staff/${inactive.uid}`,
  {
    name: stringValue("Inactive Test"),
    email: stringValue("inactive@example.test"),
    role: stringValue("ministry"),
    active: booleanValue(false),
    createdAt: timestampValue(seedTime),
    updatedAt: timestampValue(seedTime),
    createdBy: stringValue(pastor.uid),
    updatedBy: stringValue(pastor.uid)
  }
);


const pastorCreatedStaff =
  await commitCreate(
    `staff/${invitedMinistry.uid}`,
    {
      name: stringValue("Invited Ministry"),
      email: stringValue("invited-ministry@example.test"),
      role: stringValue("ministry"),
      active: booleanValue(true),
      createdBy: stringValue(pastor.uid),
      updatedBy: stringValue(pastor.uid)
    },
    ["createdAt", "updatedAt"],
    pastor.token
  );

expectStatus(
  pastorCreatedStaff,
  200,
  "Pastor staff create"
);

expectStatus(
  await getDocument(
    `staff/${invitedMinistry.uid}`,
    invitedMinistry.token
  ),
  200,
  "Ministry own staff profile read"
);

expectStatus(
  await getDocument(
    `staff/${pastor.uid}`,
    ministry.token
  ),
  403,
  "Ministry cannot read another staff profile"
);

expectStatus(
  await requestJson(
    `${firestoreBase}/documents/staff`,
    {
      token: ministry.token
    }
  ),
  403,
  "Ministry cannot list staff profiles"
);

expectStatus(
  await commitCreate(
    `staff/${authOnly.uid}`,
    {
      name: stringValue("Unauthorized Invite"),
      email: stringValue("auth-only@example.test"),
      role: stringValue("ministry"),
      active: booleanValue(true),
      createdBy: stringValue(ministry.uid),
      updatedBy: stringValue(ministry.uid)
    },
    ["createdAt", "updatedAt"],
    ministry.token
  ),
  403,
  "Ministry staff create"
);

expectStatus(
  await commitUpdate(
    `staff/${invitedMinistry.uid}`,
    {
      active: booleanValue(false),
      updatedBy: stringValue(pastor.uid)
    },
    ["active", "updatedBy"],
    ["updatedAt"],
    pastor.token
  ),
  200,
  "Pastor Ministry activation update"
);


const validPrayer =
  await commitCreate(
    "prayerRequests/public-valid",
    {
      name: stringValue("Anonymous"),
      contact: stringValue(""),
      prayerText: stringValue("Please pray for my family."),
      confidential: booleanValue(true),
      status: stringValue("new"),
      source: stringValue("website")
    },
    ["createdAt"]
  );

expectStatus(
  validPrayer,
  200,
  "Public valid prayer create"
);


const forgedPrayer =
  await commitCreate(
    "prayerRequests/public-forged",
    {
      name: stringValue("Attacker"),
      contact: stringValue(""),
      prayerText: stringValue("This request has forged fields."),
      confidential: booleanValue(false),
      status: stringValue("completed"),
      source: stringValue("website"),
      internalNotes: stringValue("not allowed")
    },
    ["createdAt"]
  );

expectStatus(
  forgedPrayer,
  403,
  "Public forged prayer create"
);


expectStatus(
  await getDocument(
    "prayerRequests/public-valid"
  ),
  403,
  "Public prayer read"
);

expectStatus(
  await getDocument(
    "prayerRequests/public-valid",
    inactive.token
  ),
  403,
  "Inactive staff prayer read"
);

expectStatus(
  await getDocument(
    "prayerRequests/public-valid",
    ministry.token
  ),
  200,
  "Active Ministry prayer read"
);


const serviceFields = {
  title: stringValue("Sunday Worship"),
  day: stringValue("Sunday"),
  time: stringValue("10:00 AM"),
  location: stringValue("Main Sanctuary"),
  details: stringValue("Weekly worship service."),
  createdBy: stringValue(ministry.uid),
  updatedBy: stringValue(ministry.uid)
};

const ministryService =
  await commitCreate(
    "services/ministry-valid",
    serviceFields,
    ["createdAt", "updatedAt"],
    ministry.token
  );

expectStatus(
  ministryService,
  200,
  "Active Ministry service create"
);

expectStatus(
  await commitCreate(
    "services/public-forged",
    {
      ...serviceFields,
      createdBy: stringValue("anonymous"),
      updatedBy: stringValue("anonymous")
    },
    ["createdAt", "updatedAt"]
  ),
  403,
  "Anonymous service create"
);

expectStatus(
  await getDocument(
    "services/ministry-valid"
  ),
  200,
  "Public service read"
);


const serviceWithExtraField =
  await commitCreate(
    "services/ministry-extra-field",
    {
      ...serviceFields,
      hiddenAdminValue:
        stringValue("not allowed")
    },
    ["createdAt", "updatedAt"],
    ministry.token
  );

expectStatus(
  serviceWithExtraField,
  403,
  "Service create with extra field"
);


const authOnlyService =
  await commitCreate(
    "services/auth-only",
    {
      ...serviceFields,
      createdBy: stringValue(authOnly.uid),
      updatedBy: stringValue(authOnly.uid)
    },
    ["createdAt", "updatedAt"],
    authOnly.token
  );

expectStatus(
  authOnlyService,
  403,
  "Auth-only service create"
);


const ministryCollections = [
  {
    path: "announcements/ministry-valid",
    fields: {
      title: stringValue("Weekly Update"),
      category: stringValue("This Week"),
      details: stringValue("A normal church announcement."),
      imageUrl: stringValue(""),
      imageAlt: stringValue(""),
      videoUrl: stringValue("")
    }
  },
  {
    path: "events/ministry-valid",
    fields: {
      title: stringValue("Community Event"),
      date: stringValue("Saturday, September 12"),
      time: stringValue("10:00 AM"),
      location: stringValue("Main Sanctuary"),
      details: stringValue("A normal church event."),
      imageUrl: stringValue(""),
      imageAlt: stringValue(""),
      videoUrl: stringValue("")
    }
  },
  {
    path: "sermons/ministry-valid",
    fields: {
      title: stringValue("A Sermon Title"),
      speaker: stringValue("Pastor Test"),
      date: stringValue("2026-08-16"),
      videoUrl: stringValue(""),
      details: stringValue("A normal sermon description."),
      imageUrl: stringValue(""),
      imageAlt: stringValue("")
    }
  },
  {
    path: "ministries/ministry-valid",
    fields: {
      name: stringValue("Youth Ministry"),
      leader: stringValue("Ministry Test"),
      schedule: stringValue("Wednesdays at 6:00 PM"),
      details: stringValue("A normal ministry description."),
      imageUrl: stringValue(""),
      imageAlt: stringValue(""),
      videoUrl: stringValue("")
    }
  }
];

for (const item of ministryCollections) {
  expectStatus(
    await commitCreate(
      item.path,
      {
        ...item.fields,
        createdBy: stringValue(ministry.uid),
        updatedBy: stringValue(ministry.uid)
      },
      ["createdAt", "updatedAt"],
      ministry.token
    ),
    200,
    `Active Ministry create ${item.path}`
  );

  expectStatus(
    await getDocument(item.path),
    200,
    `Public read ${item.path}`
  );
}

expectStatus(
  await commitUpdate(
    "services/ministry-valid",
    {
      title: stringValue("Updated Sunday Worship"),
      updatedBy: stringValue(ministry.uid)
    },
    ["title", "updatedBy"],
    ["updatedAt"],
    ministry.token
  ),
  200,
  "Active Ministry service update"
);

expectStatus(
  await commitUpdate(
    "services/ministry-valid",
    {
      title: stringValue("Inactive Update"),
      updatedBy: stringValue(inactive.uid)
    },
    ["title", "updatedBy"],
    ["updatedAt"],
    inactive.token
  ),
  403,
  "Inactive Ministry service update"
);

expectStatus(
  await commitUpdate(
    "services/ministry-valid",
    {
      title: stringValue("Anonymous Update"),
      updatedBy: stringValue("anonymous")
    },
    ["title", "updatedBy"],
    ["updatedAt"]
  ),
  403,
  "Anonymous service update"
);

expectStatus(
  await deleteDocument(
    "services/ministry-valid"
  ),
  403,
  "Anonymous service delete"
);

expectStatus(
  await deleteDocument(
    "services/ministry-valid",
    inactive.token
  ),
  403,
  "Inactive Ministry service delete"
);


const ministryGiving =
  await commitCreate(
    "siteSettings/giving",
    {
      title: stringValue("Giving"),
      message: stringValue(""),
      phone: stringValue("702-600-7632"),
      zelle: stringValue("702-600-7632"),
      cashApp: stringValue("$test"),
      cashAppLink: stringValue("https://cash.app/$test"),
      otherInstructions: stringValue(""),
      updatedBy: stringValue(ministry.uid)
    },
    ["updatedAt"],
    ministry.token
  );

expectStatus(
  ministryGiving,
  403,
  "Ministry giving create"
);


const pastorGiving =
  await commitCreate(
    "siteSettings/giving",
    {
      title: stringValue("Giving"),
      message: stringValue("Support the church."),
      phone: stringValue("702-555-0100"),
      zelle: stringValue("702-555-0100"),
      cashApp: stringValue("$Example"),
      cashAppLink: stringValue("https://cash.app/$Example"),
      otherInstructions: stringValue(""),
      updatedBy: stringValue(pastor.uid)
    },
    ["updatedAt"],
    pastor.token
  );

expectStatus(
  pastorGiving,
  200,
  "Pastor giving create"
);

expectStatus(
  await getDocument("siteSettings/giving"),
  200,
  "Public giving read"
);

expectStatus(
  await commitUpdate(
    "siteSettings/giving",
    {
      title: stringValue("Unauthorized Giving Change"),
      updatedBy: stringValue(ministry.uid)
    },
    ["title", "updatedBy"],
    ["updatedAt"],
    ministry.token
  ),
  403,
  "Ministry giving update"
);


expectStatus(
  await commitCreate(
    "siteLinks/pastor-valid",
    {
      type: stringValue("website"),
      title: stringValue("Official Website"),
      url: stringValue("https://www.hendersonpotterhouse.com/"),
      description: stringValue("Church website"),
      hidden: booleanValue(false),
      createdBy: stringValue(pastor.uid),
      updatedBy: stringValue(pastor.uid)
    },
    ["createdAt", "updatedAt"],
    pastor.token
  ),
  200,
  "Pastor site link create"
);

expectStatus(
  await commitCreate(
    "siteLinks/church-facebook",
    {
      hidden: booleanValue(true),
      updatedBy: stringValue(pastor.uid)
    },
    ["updatedAt"],
    pastor.token
  ),
  200,
  "Pastor starter link tombstone create"
);

expectStatus(
  await commitCreate(
    "siteLinks/not-a-starter",
    {
      hidden: booleanValue(true),
      updatedBy: stringValue(pastor.uid)
    },
    ["updatedAt"],
    pastor.token
  ),
  403,
  "Unknown starter link tombstone create"
);

expectStatus(
  await commitCreate(
    "siteLinks/ministry-link",
    {
      type: stringValue("website"),
      title: stringValue("Unauthorized Link"),
      url: stringValue("https://example.test/"),
      description: stringValue(""),
      hidden: booleanValue(false),
      createdBy: stringValue(ministry.uid),
      updatedBy: stringValue(ministry.uid)
    },
    ["createdAt", "updatedAt"],
    ministry.token
  ),
  403,
  "Ministry site link create"
);


const pastorHome =
  await commitCreate(
    "homeHighlights/pastor-valid",
    {
      tag: stringValue("Welcome"),
      title: stringValue("Visit Us"),
      details: stringValue("You are welcome here."),
      displayOrder: integerValue(1),
      buttonText: stringValue("Learn More"),
      buttonUrl: stringValue("services.html"),
      createdBy: stringValue(pastor.uid),
      updatedBy: stringValue(pastor.uid)
    },
    ["createdAt", "updatedAt"],
    pastor.token
  );

expectStatus(
  pastorHome,
  200,
  "Pastor homepage highlight create"
);


const ministryRoleEscalation =
  await commitUpdate(
    `staff/${ministry.uid}`,
    {
      role: stringValue("pastor"),
      updatedBy: stringValue(ministry.uid)
    },
    ["role", "updatedBy"],
    ["updatedAt"],
    ministry.token
  );

expectStatus(
  ministryRoleEscalation,
  403,
  "Ministry self role escalation"
);

expectStatus(
  await commitUpdate(
    `staff/${ministry.uid}`,
    {
      role: stringValue("pastor"),
      updatedBy: stringValue(pastor.uid)
    },
    ["role", "updatedBy"],
    ["updatedAt"],
    pastor.token
  ),
  403,
  "Pastor cannot promote a ministry record to pastor"
);


expectStatus(
  await commitCreate(
    "unknown/private-document",
    {
      value: stringValue("not allowed")
    },
    [],
    pastor.token
  ),
  403,
  "Default deny unknown collection write"
);

expectStatus(
  await getDocument(
    "unknown/private-document",
    pastor.token
  ),
  403,
  "Default deny unknown collection read"
);


expectStatus(
  await deleteDocument(
    "prayerRequests/public-valid"
  ),
  403,
  "Public prayer delete"
);

expectStatus(
  await commitUpdate(
    "prayerRequests/public-valid",
    {
      status: stringValue("completed")
    },
    ["status"],
    [],
    ministry.token
  ),
  403,
  "Prayer requests cannot be updated"
);

expectStatus(
  await commitCreate(
    "prayerRequests/ministry-delete",
    {
      name: stringValue("Anonymous"),
      contact: stringValue(""),
      prayerText: stringValue("Please pray for a private need."),
      confidential: booleanValue(true),
      status: stringValue("new"),
      source: stringValue("website")
    },
    ["createdAt"]
  ),
  200,
  "Second public prayer create"
);

expectStatus(
  await deleteDocument(
    "prayerRequests/ministry-delete",
    ministry.token
  ),
  200,
  "Active Ministry prayer delete"
);

expectStatus(
  await deleteDocument(
    "prayerRequests/public-valid",
    pastor.token
  ),
  200,
  "Pastor prayer delete"
);


console.log(
  "Firestore rules regression tests passed."
);
