import {
  auth,
  db
} from "./firebase-config.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";


const grid =
  document.getElementById("connectGrid");

const pastorShell =
  document.getElementById("connectPastorShell");

const pastorName =
  document.getElementById("connectPastorName");

const addButton =
  document.getElementById("connectAddButton");

const headingAdd =
  document.getElementById("connectHeadingAdd");

const editor =
  document.getElementById("connectEditor");

const editorMode =
  document.getElementById("connectEditorMode");

const editorTitle =
  document.getElementById("connectEditorTitle");

const closeButton =
  document.getElementById("connectCloseButton");

const cancelButton =
  document.getElementById("connectCancelButton");

const saveButton =
  document.getElementById("connectSaveButton");

const statusBox =
  document.getElementById("connectStatus");

const pageHint =
  document.getElementById("connectPageHint");

const toast =
  document.getElementById("connectToast");

let currentUser = null;
let currentLinks = [];
let firestoreLinks = new Map();
let toastTimer = null;


const TYPE_LABELS = {
  location: "Location",
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  x: "X / Twitter",
  website: "Website",
  email: "Email",
  phone: "Phone",
  other: "Other"
};

const SUPPORTED_TYPES =
  new Set(
    Object.keys(TYPE_LABELS)
  );


function normalizeType(type) {
  const normalized =
    String(type || "")
      .trim()
      .toLowerCase();

  return SUPPORTED_TYPES.has(normalized)
    ? normalized
    : "other";
}

function getTypeIcon(type) {
  const icons = {
    location: `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"></path>
        <circle cx="12" cy="10" r="2.5"></circle>
      </svg>
    `,
    facebook: `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path class="connect-icon-fill" d="M14.3 8.2V6.7c0-.8.5-1 1-1h2.5V2.1L14.5 2C11.2 2 9 4 9 7v1.2H6v4h3V22h4.5v-9.8h3.4l.6-4h-4Z"></path>
      </svg>
    `,
    instagram: `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="3" y="3" width="18" height="18" rx="5"></rect>
        <circle cx="12" cy="12" r="4"></circle>
        <circle class="connect-icon-fill" cx="17.4" cy="6.7" r="1"></circle>
      </svg>
    `,
    youtube: `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="2.5" y="5.5" width="19" height="13" rx="4"></rect>
        <path class="connect-icon-fill" d="m10 9 5 3-5 3V9Z"></path>
      </svg>
    `,
    tiktok: `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M14 4v10.2a4.7 4.7 0 1 1-3.7-4.6"></path>
        <path d="M14 4c.8 2.5 2.7 4 5 4.3"></path>
      </svg>
    `,
    x: `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M5 4 19 20"></path>
        <path d="M19 4 5 20"></path>
      </svg>
    `,
    website: `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="9"></circle>
        <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"></path>
      </svg>
    `,
    email: `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="3" y="5" width="18" height="14" rx="2.5"></rect>
        <path d="m4.5 7 7.5 6 7.5-6"></path>
      </svg>
    `,
    phone: `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M8.2 3.5 10 7.7 7.6 9.2a15.8 15.8 0 0 0 7.2 7.2l1.5-2.4 4.2 1.8-.6 3a2.5 2.5 0 0 1-2.5 2C9.6 20.2 3.8 14.4 3.2 6.6a2.5 2.5 0 0 1 2-2.5l3-.6Z"></path>
      </svg>
    `,
    other: `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="m9.5 14.5 5-5"></path>
        <path d="M7.3 16.7 5.6 18.4a3 3 0 0 1-4.2-4.2l3.5-3.5a3 3 0 0 1 4.2 0"></path>
        <path d="m16.7 7.3 1.7-1.7a3 3 0 0 1 4.2 4.2l-3.5 3.5a3 3 0 0 1-4.2 0"></path>
      </svg>
    `
  };

  return icons[type] || icons.other;
}


/*
  These links are built directly into the page.
  They appear immediately, even before anything is stored in Firestore.

  Firestore documents with the same IDs act as editable overrides.
  A pastor can change or hide any starter link.
*/
const STARTER_LINKS = [
  {
    id: "church-location",
    type: "location",
    title: "Church Location",
    url: "https://www.google.com/maps/search/?api=1&query=746+S+Boulder+Hwy%2C+Henderson%2C+NV+89015",
    description: "746 S Boulder Hwy, Henderson, NV 89015",
    isStarter: true
  },
  {
    id: "church-facebook",
    type: "facebook",
    title: "Facebook",
    url: "https://www.facebook.com/p/Henderson-Potters-House-61552769870767/",
    description: "Follow Henderson Potter's House on Facebook.",
    isStarter: true
  },
  {
    id: "church-instagram",
    type: "instagram",
    title: "Instagram",
    url: "https://www.instagram.com/hendersonphcf/",
    description: "Follow @hendersonphcf on Instagram.",
    isStarter: true
  },
  {
    id: "church-youtube",
    type: "youtube",
    title: "YouTube",
    url: "https://www.youtube.com/@thepottershouseofhenderson5075",
    description: "Watch sermons and messages from The Potter's House of Henderson Nevada.",
    isStarter: true
  },
  {
    id: "church-phone",
    type: "phone",
    title: "Church Phone",
    url: "702-600-7632",
    description: "Call the church for service and location information.",
    isStarter: true
  }
];


function normalizeRole(role) {
  return String(role || "")
    .trim()
    .toLowerCase();
}


function showToast(message, isError = false) {
  window.clearTimeout(toastTimer);

  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("show");

  toastTimer = window.setTimeout(function () {
    toast.classList.remove("show");
  }, 3200);
}


function showStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.classList.toggle("error", isError);
  statusBox.style.display = "block";
}


function hideStatus() {
  statusBox.textContent = "";
  statusBox.classList.remove("error");
  statusBox.style.display = "none";
}


function normalizeLink(type, value) {
  const normalizedType =
    normalizeType(type);

  const text =
    String(value || "").trim();

  if (!text) {
    return "";
  }

  if (normalizedType === "email") {
    const email =
      text.replace(/^mailto:/i, "");

    if (
      !email ||
      /[\r\n]/.test(email)
    ) {
      return "";
    }

    try {
      const url =
        new URL(`mailto:${email}`);

      return url.protocol === "mailto:"
        ? url.href
        : "";
    } catch (error) {
      return "";
    }
  }

  if (normalizedType === "phone") {
    const phone =
      text
        .replace(/^tel:/i, "")
        .replace(/[^\d+]/g, "");

    if (!/^\+?\d{3,}$/.test(phone)) {
      return "";
    }

    return `tel:${phone}`;
  }

  try {
    const url =
      new URL(text);

    if (
      url.protocol === "https:" ||
      url.protocol === "http:"
    ) {
      return url.href;
    }
  } catch (error) {
    return "";
  }

  return "";
}


function rebuildCurrentLinks() {
  const starterIds =
    new Set(
      STARTER_LINKS.map(function (item) {
        return item.id;
      })
    );

  const merged = [];

  STARTER_LINKS.forEach(function (starter) {
    const override =
      firestoreLinks.get(starter.id);

    if (override?.hidden === true) {
      return;
    }

    merged.push({
      id: starter.id,
      data: {
        ...starter,
        ...(override || {})
      },
      isStarter: true
    });
  });

  firestoreLinks.forEach(function (data, id) {
    if (
      starterIds.has(id) ||
      data.hidden === true
    ) {
      return;
    }

    merged.push({
      id,
      data,
      isStarter: false
    });
  });

  currentLinks = merged;
  renderLinks();
}


function openEditor(item = null) {
  editor.reset();
  hideStatus();

  editor.elements.documentId.value =
    item?.id || "";

  if (item) {
    editorMode.textContent =
      "Edit Existing";

    editorTitle.textContent =
      item.data.title ||
      "Church Link";

    saveButton.textContent =
      "Save Changes";

    editor.elements.type.value =
      item.data.type || "other";

    editor.elements.title.value =
      item.data.title || "";

    editor.elements.url.value =
      item.data.url || "";

    editor.elements.description.value =
      item.data.description || "";
  } else {
    editorMode.textContent =
      "Add New";

    editorTitle.textContent =
      "Church Link";

    saveButton.textContent =
      "Publish Link";
  }

  editor.hidden = false;

  editor.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}


function closeEditor() {
  editor.reset();
  editor.elements.documentId.value = "";
  editor.hidden = true;
  hideStatus();
}


function createCard(item) {
  const data =
    item.data;

  const type =
    normalizeType(data.type);

  const safeUrl =
    normalizeLink(
      type,
      data.url
    );

  const accessibleTitle =
    String(
      data.title ||
      TYPE_LABELS[type] ||
      "Church Link"
    ).trim();

  const card =
    document.createElement("article");

  card.className =
    "connect-card";

  card.dataset.type =
    type;

  const icon =
    document.createElement("span");

  icon.className =
    "connect-card-icon";

  // getTypeIcon only returns markup from the fixed icon allowlist above.
  icon.innerHTML =
    getTypeIcon(type);

  const heading =
    document.createElement("h3");

  heading.textContent =
    data.title ||
    TYPE_LABELS[type] ||
    "Church Link";

  const badge =
    document.createElement("span");

  badge.className =
    "connect-card-type";

  badge.textContent =
    TYPE_LABELS[type] ||
    "Other";

  const description =
    document.createElement("p");

  description.textContent =
    data.description ||
    (
      type === "location"
        ? "Open the church location and directions."
        : "Open the church's official page."
    );

  card.append(
    icon,
    heading,
    badge,
    description
  );

  if (safeUrl) {
    const openLink =
      document.createElement("a");

    openLink.className =
      "connect-card-open";

    openLink.href =
      safeUrl;

    if (
      type !== "email" &&
      type !== "phone"
    ) {
      openLink.target =
        "_blank";

      openLink.rel =
        "noopener noreferrer";
    }

    openLink.textContent =
      type === "location"
        ? "Get Directions →"
        : type === "phone"
          ? "Call Church →"
          : type === "email"
            ? "Email Church →"
            : "Open Link →";

    openLink.setAttribute(
      "aria-label",
      `${openLink.textContent.replace(" →", "")}: ${accessibleTitle}`
    );

    card.appendChild(
      openLink
    );
  }

  if (currentUser) {
    const actions =
      document.createElement("div");

    actions.className =
      "connect-card-actions";

    const edit =
      document.createElement("button");

    edit.type =
      "button";

    edit.className =
      "connect-edit-button";

    edit.textContent =
      "✏ Edit";

    edit.setAttribute(
      "aria-label",
      `Edit ${accessibleTitle}`
    );

    edit.addEventListener(
      "click",
      function () {
        openEditor(item);
      }
    );

    const remove =
      document.createElement("button");

    remove.type =
      "button";

    remove.className =
      "connect-remove-button";

    remove.textContent =
      "🗑 Remove Link";

    remove.setAttribute(
      "aria-label",
      `Remove ${accessibleTitle}`
    );

    remove.addEventListener(
      "click",
      async function () {
        const confirmed =
          window.confirm(
            `Remove "${data.title || "this link"}" from the website?`
          );

        if (!confirmed) {
          return;
        }

        try {
          if (item.isStarter) {
            /*
              Mark a built-in starter link as hidden so it does not
              return after being removed.
            */
            await setDoc(
              doc(db, "siteLinks", item.id),
              {
                hidden: true,
                updatedAt: serverTimestamp(),
                updatedBy: currentUser.uid
              },
              {
                merge: true
              }
            );
          } else {
            await deleteDoc(
              doc(db, "siteLinks", item.id)
            );
          }

          showToast(
            "Link removed from the website."
          );
        } catch (error) {
          console.error(error);

          showToast(
            "The link could not be removed. Please refresh and try again.",
            true
          );
        }
      }
    );

    actions.append(
      edit,
      remove
    );

    card.appendChild(
      actions
    );
  }

  return card;
}


function renderLinks() {
  grid.replaceChildren();

  if (currentLinks.length === 0) {
    const empty =
      document.createElement("div");

    empty.className =
      "connect-empty";

    empty.textContent =
      currentUser
        ? "No links are visible. Select Add Link to create one."
        : "The church has not published location or social media links yet.";

    grid.appendChild(
      empty
    );

    return;
  }

  currentLinks.forEach(function (item) {
    grid.appendChild(
      createCard(item)
    );
  });
}


async function loadPastorProfile(user) {
  const snapshot =
    await getDoc(
      doc(db, "staff", user.uid)
    );

  if (!snapshot.exists()) {
    return null;
  }

  const profile =
    snapshot.data();

  const role =
    normalizeRole(profile.role);

  if (
    profile.active !== true ||
    role !== "pastor"
  ) {
    return null;
  }

  return {
    ...profile,
    role
  };
}


addButton.addEventListener(
  "click",
  function () {
    openEditor();
  }
);

headingAdd.addEventListener(
  "click",
  function () {
    openEditor();
  }
);

closeButton.addEventListener(
  "click",
  closeEditor
);

cancelButton.addEventListener(
  "click",
  closeEditor
);


editor.addEventListener(
  "submit",
  async function (event) {
    event.preventDefault();

    if (!currentUser) {
      showStatus(
        "Only the approved pastor can change church links.",
        true
      );

      return;
    }

    const formData =
      new FormData(editor);

    const documentId =
      String(
        formData.get("documentId") || ""
      ).trim();

    const type =
      normalizeType(
        formData.get("type")
      );

    const title =
      String(
        formData.get("title") || ""
      ).trim();

    const enteredUrl =
      String(
        formData.get("url") || ""
      ).trim();

    const safeUrl =
      normalizeLink(
        type,
        enteredUrl
      );

    if (!safeUrl) {
      showStatus(
        "Enter a valid website link, email address, or phone number.",
        true
      );

      return;
    }

    const data = {
      type,
      title,
      url: enteredUrl,
      description:
        String(
          formData.get("description") || ""
        ).trim(),
      hidden: false,
      updatedAt:
        serverTimestamp(),
      updatedBy:
        currentUser.uid
    };

    saveButton.disabled =
      true;

    saveButton.textContent =
      documentId
        ? "Saving..."
        : "Publishing...";

    hideStatus();

    try {
      if (documentId) {
        /*
          setDoc works for both built-in starter links and normal links.
        */
        await setDoc(
          doc(db, "siteLinks", documentId),
          data,
          {
            merge: true
          }
        );

        showToast(
          "Link updated."
        );
      } else {
        await addDoc(
          collection(db, "siteLinks"),
          {
            ...data,
            createdAt:
              serverTimestamp(),
            createdBy:
              currentUser.uid
          }
        );

        showToast(
          "Link added to the website."
        );
      }

      closeEditor();
    } catch (error) {
      console.error(error);

      showStatus(
        "The link could not be saved. Please refresh and try again.",
        true
      );

      showToast(
        "The link could not be saved.",
        true
      );
    } finally {
      saveButton.disabled =
        false;
    }
  }
);


onSnapshot(
  collection(db, "siteLinks"),
  function (snapshot) {
    firestoreLinks =
      new Map(
        snapshot.docs.map(function (documentSnapshot) {
          return [
            documentSnapshot.id,
            documentSnapshot.data()
          ];
        })
      );

    rebuildCurrentLinks();
  },
  function (error) {
    console.error(error);

    /*
      The built-in starter links still display even if Firestore
      temporarily fails to load.
    */
    firestoreLinks =
      new Map();

    rebuildCurrentLinks();
  }
);


onAuthStateChanged(
  auth,
  async function (user) {
    currentUser = null;
    pastorShell.hidden = true;
    headingAdd.hidden = true;
    pastorName.textContent = "";
    pageHint.textContent =
      "Use the verified links below to find and follow the church.";
    closeEditor();

    if (!user) {
      renderLinks();
      return;
    }

    try {
      const profile =
        await loadPastorProfile(user);

      if (auth.currentUser?.uid !== user.uid) {
        return;
      }

      if (!profile) {
        renderLinks();
        return;
      }

      currentUser =
        user;

      pastorName.textContent =
        profile.name ||
        user.email ||
        "Pastor";

      pastorShell.hidden =
        false;

      headingAdd.hidden =
        false;

      pageHint.textContent =
        "Pastor editing is active. Use Edit or Remove Link directly on an item.";

      renderLinks();
    } catch (error) {
      console.error(error);
      renderLinks();
    }
  }
);
