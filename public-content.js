import {
  auth,
  db,
  firebaseConfig
} from "./firebase-config.js";

import {
  initializeApp,
  deleteApp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signOut
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";


const contentGrid = document.getElementById("publicContentGrid");
const collectionName = contentGrid?.dataset.collection || "";

const staffShell = document.getElementById("staffInlineShell");
const staffName = document.getElementById("staffInlineName");
const staffRole = document.getElementById("staffInlineRole");
const staffInitials = document.getElementById("staffInlineInitials");
const addButton = document.getElementById("staffInlineAddButton");
const headingAddButton = document.getElementById("staffInlineHeadingAdd");
const signOutButton = document.getElementById("staffInlineSignOutButton");
const editor = document.getElementById("staffInlineEditor");
const editorForm = document.getElementById("staffInlineForm");
const formMode = document.getElementById("staffInlineFormMode");
const formTitle = document.getElementById("staffInlineFormTitle");
const saveButton = document.getElementById("staffInlineSaveButton");
const cancelButton = document.getElementById("staffInlineCancelButton");
const closeButton = document.getElementById("staffInlineCloseButton");
const formStatus = document.getElementById("staffInlineStatus");
const toast = document.getElementById("staffInlineToast");

/*
  Account-management markup must not be present for public visitors. Remove
  any legacy server-shipped copy, then construct it only after the caller has
  been verified as an active pastor.
*/
document.getElementById("staffInlineAccountsButton")?.remove();
document.getElementById("staffInlineAccountsModal")?.remove();

let accountsButton = null;
let accountsModal = null;
let accountsClose = null;
let accountForm = null;
let accountStatus = null;
let accountList = null;
let accountsReturnFocus = null;
let accountsPreviousBodyOverflow = null;

let currentUser = null;
let currentStaff = null;
let currentItems = [];
let accountUnsubscribe = null;
let toastTimer = null;


const CONTENT_STATES = {
  announcements: {
    empty: "No announcements have been posted yet.",
    error: "Announcements could not be loaded right now. Please try again later."
  },
  events: {
    empty: "No upcoming events are currently listed.",
    error: "Event information could not be loaded right now. Please try again later."
  },
  services: {
    empty: "No service times are currently listed.",
    error: "Service information could not be loaded right now. Please try again later."
  },
  sermons: {
    empty: "Sermons will appear here when available.",
    error: "Sermons could not be loaded right now. Please try again later."
  },
  ministries: {
    empty: "No ministry information has been posted yet.",
    error: "Ministry information could not be loaded right now. Please try again later."
  }
};


function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}


function hasVerifiedPastorSession() {
  return Boolean(
    currentStaff?.active === true &&
    currentStaff?.role === "pastor" &&
    currentUser &&
    auth.currentUser?.uid === currentUser.uid
  );
}


function isStrongTemporaryPassword(value) {
  const password = String(value || "");

  return password.length >= 12
    && password.length <= 128
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password);
}


function getInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return parts.length
    ? parts.map(function (part) {
        return part.charAt(0).toUpperCase();
      }).join("")
    : "SM";
}


function showToast(message, isError = false) {
  if (!toast) {
    return;
  }

  window.clearTimeout(toastTimer);

  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("show");

  toastTimer = window.setTimeout(function () {
    toast.classList.remove("show");
  }, 3200);
}


function showStatus(element, message, isError = false) {
  if (!element) {
    return;
  }

  element.textContent = message;
  element.classList.toggle("error", isError);
  element.style.display = "block";
}


function hideStatus(element) {
  if (!element) {
    return;
  }

  element.textContent = "";
  element.classList.remove("error");
  element.style.display = "none";
}


function getSingularLabel() {
  const labels = {
    announcements: "Announcement",
    events: "Event",
    services: "Service",
    sermons: "Sermon",
    ministries: "Ministry"
  };

  return labels[collectionName] || "Item";
}


function getItemTitle(data) {
  if (collectionName === "ministries") {
    return data.name || "Untitled Ministry";
  }

  return data.title || "Untitled";
}


function getItemMeta(data) {
  if (collectionName === "announcements") {
    return data.category || "Announcement";
  }

  if (collectionName === "events") {
    return [
      data.date,
      data.time,
      data.location
    ].filter(Boolean).join(" • ");
  }

  if (collectionName === "services") {
    return [
      data.day,
      data.time,
      data.location
    ].filter(Boolean).join(" • ");
  }

  if (collectionName === "sermons") {
    return [
      data.speaker,
      data.date
    ].filter(Boolean).join(" • ");
  }

  if (collectionName === "ministries") {
    return [
      data.leader,
      data.schedule
    ].filter(Boolean).join(" • ");
  }

  return "";
}


function getTimestampSeconds(value) {
  if (!value) {
    return 0;
  }

  if (typeof value.seconds === "number") {
    return value.seconds;
  }

  if (typeof value.toDate === "function") {
    return Math.floor(value.toDate().getTime() / 1000);
  }

  return 0;
}


function getSortTime(data) {
  return Math.max(
    getTimestampSeconds(data.updatedAt),
    getTimestampSeconds(data.createdAt)
  );
}


function schemaText(value, maximum = 3000) {
  return String(value || "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maximum);
}


function strictIsoDate(value) {
  const text = String(value || "").trim();

  if (text.length !== 10) {
    return "";
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);

  if (!match) {
    return "";
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return "";
  }

  return text;
}


function strictEventDate(value) {
  const isoDate = strictIsoDate(value);

  if (isoDate) {
    return isoDate;
  }

  const text = String(value || "").trim();

  if (text.length > 50) {
    return "";
  }

  const match = /^(?:(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday),\s+)?(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})$/i.exec(text);

  if (!match) {
    return "";
  }

  const weekdays = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday"
  ];
  const months = {
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11
  };
  const expectedWeekday = String(match[1] || "").toLowerCase();
  const month = months[String(match[2]).toLowerCase()];
  const day = Number(match[3]);
  const year = Number(match[4]);
  const date = new Date(Date.UTC(year, month, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== day ||
    (
      expectedWeekday &&
      weekdays[date.getUTCDay()] !== expectedWeekday
    )
  ) {
    return "";
  }

  return [
    String(year).padStart(4, "0"),
    String(month + 1).padStart(2, "0"),
    String(day).padStart(2, "0")
  ].join("-");
}


function strictSchemaTime(value) {
  const text = String(value || "").trim();

  if (text.length > 20) {
    return "";
  }

  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(text);

  if (!match) {
    return "";
  }

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || 0);
  const meridiem = String(match[4] || "").toUpperCase();

  if (minute > 59 || second > 59) {
    return "";
  }

  if (meridiem) {
    if (hour < 1 || hour > 12) {
      return "";
    }

    hour %= 12;

    if (meridiem === "PM") {
      hour += 12;
    }
  } else if (hour > 23) {
    return "";
  }

  return [hour, minute, second]
    .map(function (part) {
      return String(part).padStart(2, "0");
    })
    .join(":");
}


function timestampIso(value) {
  try {
    const date = value && typeof value.toDate === "function"
      ? value.toDate()
      : null;

    return date && Number.isFinite(date.getTime())
      ? date.toISOString()
      : "";
  } catch (error) {
    return "";
  }
}


function canonicalPageUrl() {
  const candidate =
    document.querySelector('link[rel="canonical"]')?.href ||
    window.location.href;

  try {
    const url = new URL(candidate, window.location.href);

    if (!["http:", "https:"].includes(url.protocol)) {
      return "";
    }

    url.hash = "";
    url.search = "";
    return url.href;
  } catch (error) {
    return "";
  }
}


function schemaItemId(item) {
  const pageUrl = canonicalPageUrl();

  return pageUrl
    ? `${pageUrl}#${collectionName}-${encodeURIComponent(item.id)}`
    : "";
}


function addSharedSchemaFields(node, item) {
  const itemId = schemaItemId(item);
  const created = timestampIso(item.data.createdAt);
  const updated = timestampIso(item.data.updatedAt);

  if (itemId) {
    node["@id"] = itemId;
    node.url = itemId;
  }

  if (created) {
    node.dateCreated = created;
  }

  if (updated) {
    node.dateModified = updated;
  }

  const imageUrl = getSafeMediaUrl(item.data.imageUrl);

  if (imageUrl) {
    node.image = imageUrl;
  }

  return node;
}


function announcementSchema(item) {
  const title = schemaText(item.data.title, 120);
  const details = schemaText(item.data.details);

  if (!title) {
    return null;
  }

  const article = addSharedSchemaFields({
    "@type": "Article",
    headline: title
  }, item);

  if (details) {
    article.articleBody = details;
  }

  const category = schemaText(item.data.category, 80);

  if (category) {
    article.articleSection = category;
  }

  if (article.dateCreated) {
    article.datePublished = article.dateCreated;
  }

  return article;
}


function eventSchema(item) {
  const title = schemaText(item.data.title, 120);
  const date = strictEventDate(item.data.date);

  if (!title || !date) {
    return null;
  }

  const time = strictSchemaTime(item.data.time);
  const event = addSharedSchemaFields({
    "@type": "Event",
    name: title,
    startDate: time ? `${date}T${time}` : date
  }, item);

  const details = schemaText(item.data.details);
  const location = schemaText(item.data.location, 200);

  if (details) {
    event.description = details;
  }

  if (location) {
    event.location = {
      "@type": "Place",
      name: location
    };
  }

  return event;
}


function serviceSchema(item) {
  const days = {
    sunday: "https://schema.org/Sunday",
    monday: "https://schema.org/Monday",
    tuesday: "https://schema.org/Tuesday",
    wednesday: "https://schema.org/Wednesday",
    thursday: "https://schema.org/Thursday",
    friday: "https://schema.org/Friday",
    saturday: "https://schema.org/Saturday"
  };

  const title = schemaText(item.data.title, 120);
  const day = days[schemaText(item.data.day, 20).toLowerCase()] || "";
  const time = strictSchemaTime(item.data.time);

  if (!title || !day || !time) {
    return null;
  }

  const event = addSharedSchemaFields({
    "@type": "Event",
    name: title,
    eventSchedule: {
      "@type": "Schedule",
      repeatFrequency: "P1W",
      byDay: day,
      startTime: time
    }
  }, item);

  const details = schemaText(item.data.details);
  const location = schemaText(item.data.location, 200);

  if (details) {
    event.description = details;
  }

  if (location) {
    event.location = {
      "@type": "Place",
      name: location
    };
  }

  return event;
}


function ministrySchema(item) {
  const name = schemaText(item.data.name, 120);

  if (!name) {
    return null;
  }

  const organization = addSharedSchemaFields({
    "@type": "Organization",
    name
  }, item);
  const details = schemaText(item.data.details);

  if (details) {
    organization.description = details;
  }

  return organization;
}


function sermonSchema(item) {
  const title = schemaText(item.data.title, 120);
  const details = schemaText(item.data.details);

  if (!title) {
    return null;
  }

  const videoUrl = getSafeMediaUrl(item.data.videoUrl);
  const embedUrl = getYouTubeEmbedUrl(videoUrl);
  const directVideo = isDirectVideoUrl(videoUrl);
  const hasVideo = Boolean(embedUrl || directVideo);
  const node = addSharedSchemaFields({
    "@type": hasVideo ? "VideoObject" : "CreativeWork",
    name: title
  }, item);
  const speaker = schemaText(item.data.speaker, 120);
  const sermonDate = strictIsoDate(item.data.date);

  if (details) {
    node.description = details;
  }

  if (speaker) {
    node.creator = {
      "@type": "Person",
      name: speaker
    };
  }

  if (sermonDate) {
    node.dateCreated = sermonDate;

    if (hasVideo) {
      node.uploadDate = sermonDate;
    }
  }

  if (hasVideo) {
    if (embedUrl) {
      node.embedUrl = embedUrl;
    } else {
      node.contentUrl = videoUrl;
    }

    if (typeof node.image === "string") {
      node.thumbnailUrl = node.image;
    }
  }

  return node;
}


function renderDynamicContentSchema() {
  const builders = {
    announcements: announcementSchema,
    events: eventSchema,
    services: serviceSchema,
    ministries: ministrySchema,
    sermons: sermonSchema
  };
  const builder = builders[collectionName];
  let schemaElement = document.getElementById("dynamicContentSchema");

  if (!builder) {
    schemaElement?.remove();
    return;
  }

  if (!schemaElement) {
    schemaElement = document.createElement("script");
    schemaElement.id = "dynamicContentSchema";
    schemaElement.type = "application/ld+json";
    document.head.appendChild(schemaElement);
  }

  const nodes = currentItems
    .map(builder)
    .filter(Boolean);

  schemaElement.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: nodes.map(function (node, index) {
      return {
        "@type": "ListItem",
        position: index + 1,
        item: node
      };
    })
  });
}


function openEditor(item = null) {
  if (!currentStaff || !editor || !editorForm) {
    return;
  }

  editorForm.reset();
  hideStatus(formStatus);

  const documentIdField = editorForm.elements.documentId;
  documentIdField.value = item?.id || "";

  if (item) {
    formMode.textContent = "Edit Existing";
    formTitle.textContent = getItemTitle(item.data);
    saveButton.textContent = "Save Changes";

    Object.entries(item.data).forEach(function ([key, value]) {
      const field = editorForm.elements[key];

      if (!field) {
        return;
      }

      if (value && typeof value.toDate === "function") {
        field.value = value.toDate().toISOString().slice(0, 10);
      } else {
        field.value = value ?? "";
      }
    });
  } else {
    formMode.textContent = "Add New";
    formTitle.textContent = getSingularLabel();
    saveButton.textContent = `Publish ${getSingularLabel()}`;
  }

  editor.hidden = false;

  editor.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}


function closeEditor() {
  if (!editor || !editorForm) {
    return;
  }

  editorForm.reset();
  editorForm.elements.documentId.value = "";
  editor.hidden = true;
  hideStatus(formStatus);
}


async function loadStaffProfile(user) {
  const snapshot = await getDoc(
    doc(db, "staff", user.uid)
  );

  if (!snapshot.exists()) {
    return null;
  }

  const profile = snapshot.data();
  const role = normalizeRole(profile.role);

  if (
    profile.active !== true ||
    !["pastor", "ministry"].includes(role)
  ) {
    return null;
  }

  return {
    ...profile,
    role
  };
}


function enableStaffEditing(user, profile) {
  currentUser = user;
  currentStaff = profile;

  const displayName =
    profile.name ||
    user.email ||
    "Staff Member";

  staffShell.hidden = false;
  headingAddButton.hidden = false;
  staffName.textContent = displayName;
  staffRole.textContent =
    profile.role === "pastor"
      ? "Pastor"
      : "Ministry";

  staffInitials.textContent =
    getInitials(displayName);

  if (profile.role === "pastor") {
    mountAccountManager();
  } else {
    unmountAccountManager();
  }

  renderItems();
}


function disableStaffEditing() {
  unmountAccountManager();

  currentUser = null;
  currentStaff = null;

  if (staffShell) {
    staffShell.hidden = true;
  }

  if (headingAddButton) {
    headingAddButton.hidden = true;
  }

  if (staffName) {
    staffName.textContent = "Staff Member";
  }

  if (staffRole) {
    staffRole.textContent = "Staff";
  }

  if (staffInitials) {
    staffInitials.textContent = "SM";
  }

  closeEditor();
  renderItems();
}


function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);

  if (className) {
    element.className = className;
  }

  element.textContent = text;

  return element;
}


function getSafeMediaUrl(value) {
  const text =
    String(value || "").trim();

  if (!text) {
    return "";
  }

  if (
    /^(javascript|data|vbscript):/i.test(text)
  ) {
    return "";
  }

  try {
    const resolved =
      new URL(text, window.location.href);

    if (
      !["http:", "https:"].includes(
        resolved.protocol
      )
    ) {
      return "";
    }

    return resolved.href;
  } catch (error) {
    return "";
  }
}


function getYouTubeEmbedUrl(value) {
  const safeUrl =
    getSafeMediaUrl(value);

  if (!safeUrl) {
    return "";
  }

  try {
    const parsed =
      new URL(safeUrl);

    let videoId = "";
    const hostname = parsed.hostname
      .toLowerCase()
      .replace(/\.$/, "");

    if (
      hostname === "youtu.be" ||
      hostname === "www.youtu.be"
    ) {
      videoId =
        parsed.pathname
          .split("/")
          .filter(Boolean)[0] || "";
    } else if ([
      "youtube.com",
      "www.youtube.com",
      "m.youtube.com",
      "music.youtube.com"
    ].includes(hostname)) {
      if (
        parsed.pathname === "/watch"
      ) {
        videoId =
          parsed.searchParams.get("v") || "";
      } else {
        const parts =
          parsed.pathname
            .split("/")
            .filter(Boolean);

        if (
          ["embed", "shorts", "live"].includes(
            parts[0]
          )
        ) {
          videoId =
            parts[1] || "";
        }
      }
    }

    if (
      !/^[a-zA-Z0-9_-]{6,20}$/.test(videoId)
    ) {
      return "";
    }

    return `https://www.youtube.com/embed/${videoId}`;
  } catch (error) {
    return "";
  }
}


function isDirectVideoUrl(value) {
  const safeUrl =
    getSafeMediaUrl(value);

  return /\.(mp4|webm|ogg)(?:[?#].*)?$/i.test(
    safeUrl
  );
}


function appendMediaToCard(card, data) {
  const imageUrl =
    getSafeMediaUrl(data.imageUrl);

  const videoUrl =
    getSafeMediaUrl(data.videoUrl);

  if (imageUrl) {
    const image =
      document.createElement("img");

    image.className =
      "staff-inline-card-image";

    image.src =
      imageUrl;

    image.alt =
      data.imageAlt ||
      getItemTitle(data);

    image.loading =
      "lazy";

    image.addEventListener(
      "error",
      function () {
        image.remove();
      },
      {
        once: true
      }
    );

    card.appendChild(image);
  }

  if (!videoUrl) {
    return;
  }

  const youtubeEmbed =
    getYouTubeEmbedUrl(videoUrl);

  if (youtubeEmbed) {
    const frameWrap =
      document.createElement("div");

    frameWrap.className =
      "staff-inline-card-video-frame";

    const frame =
      document.createElement("iframe");

    frame.src =
      youtubeEmbed;

    frame.title =
      `${getItemTitle(data)} video`;

    frame.loading =
      "lazy";

    frame.allow =
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";

    frame.referrerPolicy =
      "strict-origin-when-cross-origin";

    frame.allowFullscreen =
      true;

    frameWrap.appendChild(frame);
    card.appendChild(frameWrap);

    return;
  }

  if (isDirectVideoUrl(videoUrl)) {
    const video =
      document.createElement("video");

    video.className =
      "staff-inline-card-direct-video";

    video.src =
      videoUrl;

    video.controls =
      true;

    video.preload =
      "metadata";

    card.appendChild(video);

    return;
  }

  const videoLink =
    document.createElement("a");

  videoLink.className =
    "staff-inline-card-video";

  videoLink.href =
    videoUrl;

  videoLink.target =
    "_blank";

  videoLink.rel =
    "noopener noreferrer";

  videoLink.textContent =
    collectionName === "sermons"
      ? "Watch Sermon →"
      : "Watch Video →";

  card.appendChild(videoLink);
}


function createContentCard(item) {
  const data = item.data;
  const card = document.createElement("article");

  card.className = "content-card";

  if (currentStaff) {
    card.classList.add("staff-editable-card");
  }

  const tagRow = document.createElement("div");

  const tag = createTextElement(
    "span",
    "tag",
    collectionName === "announcements"
      ? data.category || "Announcement"
      : getSingularLabel()
  );

  tagRow.appendChild(tag);

  if (currentStaff) {
    tagRow.appendChild(
      createTextElement(
        "span",
        "staff-inline-live",
        "LIVE ON WEBSITE"
      )
    );
  }

  const title = createTextElement(
    "h3",
    "",
    getItemTitle(data)
  );

  card.append(
    tagRow,
    title
  );

  const metaText = getItemMeta(data);

  if (metaText) {
    card.appendChild(
      createTextElement(
        "div",
        "staff-inline-card-meta",
        metaText
      )
    );
  }

  appendMediaToCard(
    card,
    data
  );

  if (data.details) {
    card.appendChild(
      createTextElement(
        "p",
        "",
        data.details
      )
    );
  }

  if (currentStaff) {
    const actions =
      document.createElement("div");

    actions.className =
      "staff-inline-card-actions";

    const editButton =
      document.createElement("button");

    editButton.className =
      "staff-inline-edit-button";

    editButton.type = "button";
    editButton.textContent = "✏ Edit";

    editButton.addEventListener("click", function () {
      openEditor(item);
    });

    const removeButton =
      document.createElement("button");

    removeButton.className =
      "staff-inline-remove-button";

    removeButton.type = "button";
    removeButton.textContent =
      "🗑 Remove From Website";

    removeButton.addEventListener("click", async function () {
      const confirmed = window.confirm(
        `Remove "${getItemTitle(data)}" from the public website?\n\nThis cannot be undone.`
      );

      if (!confirmed) {
        return;
      }

      try {
        await deleteDoc(
          doc(db, collectionName, item.id)
        );

        showToast(
          `${getSingularLabel()} removed from the website.`
        );
      } catch (error) {
        console.error(error);

        showToast(
          "The item could not be removed. Please refresh and try again.",
          true
        );
      }
    });

    actions.append(
      editButton,
      removeButton
    );

    card.appendChild(actions);
  }

  return card;
}


function renderItems() {
  if (!contentGrid) {
    return;
  }

  renderDynamicContentSchema();
  contentGrid.replaceChildren();

  if (currentItems.length === 0) {
    const empty = createTextElement(
      "div",
      "empty-state",
      CONTENT_STATES[collectionName]?.empty ||
        "No church information has been posted yet."
    );

    contentGrid.appendChild(empty);
    return;
  }

  currentItems.forEach(function (item) {
    contentGrid.appendChild(
      createContentCard(item)
    );
  });
}


function subscribeToContent() {
  if (!collectionName) {
    return;
  }

  onSnapshot(
    collection(db, collectionName),
    function (snapshot) {
      currentItems = snapshot.docs
        .map(function (documentSnapshot) {
          return {
            id: documentSnapshot.id,
            data: documentSnapshot.data()
          };
        })
        .sort(function (a, b) {
          return (
            getSortTime(b.data) -
            getSortTime(a.data)
          );
        });

      renderItems();
    },
    function (error) {
      console.error(error);
      currentItems = [];
      renderDynamicContentSchema();
      contentGrid.replaceChildren(
        createTextElement(
          "div",
          "empty-state",
          CONTENT_STATES[collectionName]?.error ||
            "Church information could not be loaded right now. Please try again later."
        )
      );
    }
  );
}


if (addButton) {
  addButton.addEventListener("click", function () {
    openEditor();
  });
}


if (headingAddButton) {
  headingAddButton.addEventListener("click", function () {
    openEditor();
  });
}


if (cancelButton) {
  cancelButton.addEventListener("click", closeEditor);
}


if (closeButton) {
  closeButton.addEventListener("click", closeEditor);
}


if (editorForm) {
  editorForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!currentUser || !currentStaff) {
      showStatus(
        formStatus,
        "Your staff session ended. Sign in again.",
        true
      );

      return;
    }

    const formData = new FormData(editorForm);
    const documentId =
      String(formData.get("documentId") || "").trim();

    const data = {};

    for (const [key, value] of formData.entries()) {
      if (key === "documentId") {
        continue;
      }

      data[key] = String(value).trim();
    }

    saveButton.disabled = true;
    saveButton.textContent =
      documentId
        ? "Saving Changes..."
        : "Publishing...";

    hideStatus(formStatus);

    try {
      if (documentId) {
        await updateDoc(
          doc(db, collectionName, documentId),
          {
            ...data,
            updatedAt: serverTimestamp(),
            updatedBy: currentUser.uid
          }
        );

        showToast("Changes saved.");
      } else {
        await addDoc(
          collection(db, collectionName),
          {
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: currentUser.uid,
            updatedBy: currentUser.uid
          }
        );

        showToast(
          `${getSingularLabel()} published.`
        );
      }

      closeEditor();
    } catch (error) {
      console.error(error);

      const permissionDenied =
        error.code === "permission-denied" ||
        error.code === "firestore/permission-denied";

      const errorMessage = permissionDenied
        ? "Your staff account does not have permission to save this item. Sign out and back in, then try again."
        : "The item could not be saved. Check your connection and try again.";

      showStatus(
        formStatus,
        errorMessage,
        true
      );

      showToast(
        permissionDenied
          ? "Your staff account cannot save this item."
          : "The item could not be saved.",
        true
      );
    } finally {
      saveButton.disabled = false;
    }
  });
}


if (signOutButton) {
  signOutButton.addEventListener("click", async function () {
    signOutButton.disabled = true;

    try {
      await signOut(auth);
      window.location.reload();
    } catch (error) {
      console.error(error);

      signOutButton.disabled = false;

      showToast(
        "Could not sign out. Please try again.",
        true
      );
    }
  });
}


function openAccountsModal() {
  if (
    !accountsModal ||
    !accountsModal.hidden ||
    !hasVerifiedPastorSession()
  ) {
    return;
  }

  accountsReturnFocus = document.activeElement;
  accountsPreviousBodyOverflow = document.body.style.overflow;
  accountsModal.hidden = false;
  accountsButton?.setAttribute("aria-expanded", "true");
  document.body.style.overflow = "hidden";

  const firstField =
    accountForm?.querySelector("input, button");

  window.requestAnimationFrame(function () {
    (firstField || accountsClose)?.focus();
  });
}


function closeAccountsModal({
  restoreFocus = true
} = {}) {
  if (!accountsModal) {
    return;
  }

  const wasOpen = !accountsModal.hidden;

  accountsModal.hidden = true;
  accountsButton?.setAttribute("aria-expanded", "false");

  if (wasOpen) {
    document.body.style.overflow =
      accountsPreviousBodyOverflow ?? "";
  }

  accountsPreviousBodyOverflow = null;
  hideStatus(accountStatus);

  if (
    restoreFocus &&
    accountsReturnFocus instanceof HTMLElement &&
    accountsReturnFocus.isConnected
  ) {
    accountsReturnFocus.focus();
  }

  accountsReturnFocus = null;
}


function accountFocusableElements() {
  if (!accountsModal || accountsModal.hidden) {
    return [];
  }

  return [...accountsModal.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter(function (element) {
    return !element.hidden && element.getClientRects().length > 0;
  });
}


function handleAccountsKeydown(event) {
  if (!accountsModal || accountsModal.hidden) {
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    closeAccountsModal();
    return;
  }

  if (event.key !== "Tab") {
    return;
  }

  const focusable = accountFocusableElements();

  if (focusable.length === 0) {
    event.preventDefault();
    accountsClose?.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const focusIsInside = focusable.includes(
    document.activeElement
  );

  if (!focusIsInside) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  } else if (
    event.shiftKey &&
    document.activeElement === first
  ) {
    event.preventDefault();
    last.focus();
  } else if (
    !event.shiftKey &&
    document.activeElement === last
  ) {
    event.preventDefault();
    first.focus();
  }
}


function handleAccountsBackdropClick(event) {
  if (event.target === accountsModal) {
    closeAccountsModal();
  }
}


function renderAccounts(snapshot) {
  if (
    !accountList ||
    !hasVerifiedPastorSession()
  ) {
    return;
  }

  const pastorSnapshot = currentUser
    ? snapshot.docs.find(function (documentSnapshot) {
        return documentSnapshot.id === currentUser.uid;
      })
    : null;
  const pastorData = pastorSnapshot?.data();

  if (
    !pastorData ||
    pastorData.active !== true ||
    normalizeRole(pastorData.role) !== "pastor"
  ) {
    disableStaffEditing();
    return;
  }

  const accounts = snapshot.docs
    .filter(function (documentSnapshot) {
      return normalizeRole(
        documentSnapshot.data().role
      ) === "ministry";
    })
    .map(function (documentSnapshot) {
      return {
        id: documentSnapshot.id,
        data: documentSnapshot.data()
      };
    })
    .sort(function (a, b) {
      return String(a.data.name || "").localeCompare(
        String(b.data.name || "")
      );
    });

  accountList.replaceChildren();
  accountList.setAttribute("aria-busy", "false");

  if (accounts.length === 0) {
    accountList.appendChild(
      createTextElement(
        "div",
        "staff-inline-empty",
        "No ministry accounts have been added yet."
      )
    );

    return;
  }

  accounts.forEach(function (account) {
    const item =
      document.createElement("article");

    item.className =
      "staff-inline-account-item";

    const head =
      document.createElement("div");

    head.className =
      "staff-inline-account-item-head";

    const copy =
      document.createElement("div");

    const name =
      createTextElement(
        "strong",
        "",
        account.data.name || "Ministry Member"
      );

    const email =
      createTextElement(
        "small",
        "",
        account.data.email || "No email listed"
      );

    copy.append(
      name,
      email
    );

    const badge =
      createTextElement(
        "span",
        account.data.active === true
          ? "staff-inline-account-badge active"
          : "staff-inline-account-badge inactive",
        account.data.active === true
          ? "ACTIVE"
          : "ACCESS REMOVED"
      );

    head.append(
      copy,
      badge
    );

    const actions =
      document.createElement("div");

    actions.className =
      "staff-inline-account-actions";

    const resetButton =
      document.createElement("button");

    resetButton.type =
      "button";

    resetButton.className =
      "staff-inline-account-action password-reset";

    resetButton.textContent =
      "Send Password Reset";

    resetButton.addEventListener(
      "click",
      async function () {
        if (!hasVerifiedPastorSession()) {
          showToast("Your pastor session has ended.", true);
          return;
        }

        const accountEmail =
          String(account.data.email || "")
            .trim()
            .toLowerCase();

        if (!accountEmail) {
          showToast(
            "This account does not have an email address.",
            true
          );

          return;
        }

        const confirmed =
          window.confirm(
            `Send a password-reset email to ${accountEmail}?`
          );

        if (!confirmed) {
          return;
        }

        resetButton.disabled = true;
        resetButton.textContent = "Sending...";

        try {
          await sendPasswordResetEmail(
            auth,
            accountEmail
          );

          showToast(
            "Password-reset email sent."
          );
        } catch (error) {
          console.error(error);

          let message =
            "The password-reset email could not be sent.";

          if (
            error.code === "auth/user-not-found"
          ) {
            message =
              "That ministry account no longer exists.";
          } else if (
            error.code === "auth/invalid-email"
          ) {
            message =
              "This ministry account has an invalid email address.";
          } else if (
            error.code === "auth/too-many-requests"
          ) {
            message =
              "Too many reset attempts were made. Wait a few minutes and try again.";
          }

          showToast(
            message,
            true
          );
        } finally {
          resetButton.disabled = false;
          resetButton.textContent =
            "Send Password Reset";
        }
      }
    );

    const toggle =
      document.createElement("button");

    toggle.type =
      "button";

    toggle.className =
      account.data.active === true
        ? "staff-inline-account-action access-remove"
        : "staff-inline-account-action access-restore";

    toggle.textContent =
      account.data.active === true
        ? "Remove Website Access"
        : "Restore Website Access";

    toggle.addEventListener(
      "click",
      async function () {
        if (!hasVerifiedPastorSession()) {
          showToast("Your pastor session has ended.", true);
          return;
        }

        const nextActive =
          account.data.active !== true;

        const confirmed =
          window.confirm(
            `${
              nextActive ? "Restore" : "Remove"
            } website access for ${
              account.data.name ||
              account.data.email ||
              "this account"
            }?`
          );

        if (!confirmed) {
          return;
        }

        toggle.disabled = true;

        try {
          await updateDoc(
            doc(db, "staff", account.id),
            {
              active: nextActive,
              updatedAt: serverTimestamp(),
              updatedBy: currentUser.uid
            }
          );

          showToast(
            nextActive
              ? "Ministry access restored."
              : "Ministry access removed."
          );
        } catch (error) {
          console.error(error);

          showToast(
            "The account access could not be updated.",
            true
          );
        } finally {
          toggle.disabled = false;
        }
      }
    );

    actions.append(
      resetButton,
      toggle
    );

    item.append(
      head,
      actions
    );

    accountList.appendChild(item);
  });
}


function subscribeToAccounts() {
  if (
    !accountList ||
    !hasVerifiedPastorSession()
  ) {
    return;
  }

  if (accountUnsubscribe) {
    accountUnsubscribe();
  }

  accountUnsubscribe = onSnapshot(
    collection(db, "staff"),
    renderAccounts,
    function (error) {
      console.error(error);

      if (
        error.code === "permission-denied" ||
        error.code === "firestore/permission-denied"
      ) {
        disableStaffEditing();
        return;
      }

      if (accountList) {
        accountList.setAttribute("aria-busy", "false");
        accountList.replaceChildren(
          createTextElement(
            "div",
            "staff-inline-empty",
            "Accounts could not be loaded."
          )
        );
      }
    }
  );
}


function secureRandomIndex(length) {
  if (
    !Number.isInteger(length) ||
    length < 1 ||
    length > 256 ||
    !window.crypto?.getRandomValues
  ) {
    throw new Error("Secure random values are unavailable.");
  }

  const maximum = 256 - (256 % length);
  const value = new Uint8Array(1);

  do {
    window.crypto.getRandomValues(value);
  } while (value[0] >= maximum);

  return value[0] % length;
}


function secureRandomCharacter(characters) {
  return characters[secureRandomIndex(characters.length)];
}


function createBootstrapPassword() {
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const numbers = "23456789";
  const symbols = "!@#$%*-_";
  const all = lower + upper + numbers + symbols;
  const characters = [
    secureRandomCharacter(lower),
    secureRandomCharacter(upper),
    secureRandomCharacter(numbers),
    secureRandomCharacter(symbols)
  ];

  while (characters.length < 32) {
    characters.push(
      secureRandomCharacter(all)
    );
  }

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = secureRandomIndex(index + 1);

    [characters[index], characters[swapIndex]] =
      [characters[swapIndex], characters[index]];
  }

  const password = characters.join("");

  if (!isStrongTemporaryPassword(password)) {
    throw new Error("The bootstrap password did not meet policy.");
  }

  return password;
}


async function handleAccountFormSubmit(event) {
  event.preventDefault();

  const formAtStart = event.currentTarget;
  const statusAtStart = accountStatus;

  if (
    !hasVerifiedPastorSession()
  ) {
    showStatus(
      statusAtStart,
      "Only the pastor can create ministry accounts.",
      true
    );

    return;
  }

  const nameInput = formAtStart.elements.name;
  const emailInput = formAtStart.elements.email;
  const name = String(nameInput?.value || "").trim();
  const email = String(emailInput?.value || "")
    .trim()
    .toLowerCase();

  if (!name || name.length > 100) {
    showStatus(
      statusAtStart,
      "Enter the ministry member's name using 100 characters or fewer.",
      true
    );
    nameInput?.focus();
    return;
  }

  if (
    !email ||
    email.length > 254 ||
    !emailInput?.checkValidity()
  ) {
    showStatus(
      statusAtStart,
      "Enter a valid email address.",
      true
    );
    emailInput?.focus();
    return;
  }

  const submitButton =
    formAtStart.querySelector('[type="submit"]');
  const pastorUid = currentUser.uid;
  let secondaryApp = null;
  let secondaryAuth = null;
  let createdUser = null;
  let staffRecordCreated = false;
  let invitationSent = false;
  let cleanupFailed = false;
  let password = "";

  submitButton.disabled = true;
  submitButton.textContent = "Creating Account...";
  hideStatus(statusAtStart);

  try {
    password = createBootstrapPassword();
    secondaryApp = initializeApp(
      firebaseConfig,
      `ministry-account-${Date.now()}-${secureRandomIndex(256)}`
    );
    secondaryAuth = getAuth(secondaryApp);

    const credential =
      await createUserWithEmailAndPassword(
        secondaryAuth,
        email,
        password
      );

    password = "";
    createdUser = credential.user;

    await setDoc(
      doc(db, "staff", createdUser.uid),
      {
        name,
        email,
        role: "ministry",
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: pastorUid,
        updatedBy: pastorUid
      }
    );

    staffRecordCreated = true;

    try {
      await sendPasswordResetEmail(
        secondaryAuth,
        email
      );
      invitationSent = true;
    } catch (invitationError) {
      console.error(
        "Ministry password setup email failed.",
        invitationError
      );
    }

    formAtStart.reset();

    if (invitationSent) {
      showStatus(
        statusAtStart,
        "Ministry account created. A password setup email was sent to the member."
      );
      showToast("Ministry account created and setup email sent.");
    } else {
      const warning =
        "Ministry account created, but the password setup email could not be sent. Use Send Password Reset beside the account to try again.";

      showStatus(statusAtStart, warning, true);
      showToast(warning, true);
    }
  } catch (error) {
    password = "";
    console.error(error);

    if (createdUser && !staffRecordCreated) {
      try {
        await deleteUser(createdUser);
      } catch (cleanupError) {
        cleanupFailed = true;
        console.error(
          "Incomplete ministry Auth user cleanup failed.",
          cleanupError
        );
      }
    }

    let message =
      "The ministry account could not be created.";

    if (error.code === "auth/email-already-in-use") {
      message =
        "An account already exists with that email address.";
    } else if (error.code === "auth/weak-password") {
      message =
        "The secure setup password did not meet the Firebase password policy. Review the Firebase password policy and try again.";
    } else if (error.code === "auth/invalid-email") {
      message =
        "Enter a valid email address.";
    } else if (
      error.code === "permission-denied" ||
      error.code === "firestore/permission-denied"
    ) {
      message =
        "The ministry account could not be created. Please review staff access and try again.";
    } else if (
      error.code === "auth/operation-not-allowed"
    ) {
      message =
        "Account creation is currently unavailable. Please contact the site administrator.";
    } else if (
      error.code === "auth/network-request-failed"
    ) {
      message =
        "The account service could not be reached. Check your connection and try again.";
    }

    if (cleanupFailed) {
      message +=
        " An incomplete Firebase Authentication account may remain and should be removed before retrying.";
    }

    showStatus(statusAtStart, message, true);
    showToast(message, true);
  } finally {
    password = "";

    if (secondaryAuth?.currentUser) {
      try {
        await signOut(secondaryAuth);
      } catch (error) {
        console.error(error);
      }
    }

    if (secondaryApp) {
      try {
        await deleteApp(secondaryApp);
      } catch (error) {
        console.error(error);
      }
    }

    if (submitButton.isConnected) {
      submitButton.disabled = false;
      submitButton.textContent =
        "Create Account & Send Setup Email";
    }
  }
}


function handleAccountsCloseClick() {
  closeAccountsModal();
}


function mountAccountManager() {
  if (
    accountsModal ||
    accountsButton ||
    !hasVerifiedPastorSession() ||
    !signOutButton?.parentElement
  ) {
    return;
  }

  accountsButton = document.createElement("button");
  accountsButton.className = "staff-inline-accounts-button";
  accountsButton.id = "staffInlineAccountsButton";
  accountsButton.type = "button";
  accountsButton.textContent = "Ministry Accounts";
  accountsButton.setAttribute("aria-haspopup", "dialog");
  accountsButton.setAttribute(
    "aria-controls",
    "staffInlineAccountsModal"
  );
  accountsButton.setAttribute("aria-expanded", "false");
  signOutButton.parentElement.insertBefore(
    accountsButton,
    signOutButton
  );

  accountsModal = document.createElement("div");
  accountsModal.className = "staff-inline-modal-backdrop";
  accountsModal.id = "staffInlineAccountsModal";
  accountsModal.hidden = true;
  accountsModal.innerHTML = `
    <div
      class="staff-inline-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="staffInlineAccountsTitle"
      aria-describedby="staffInlineAccountsDescription"
    >
      <div class="staff-inline-modal-heading">
        <div>
          <span>Pastor Only</span>
          <h2 id="staffInlineAccountsTitle">Ministry Accounts</h2>
          <p id="staffInlineAccountsDescription">
            Create ministry accounts or remove and restore website access.
          </p>
        </div>

        <button
          class="staff-inline-close"
          id="staffInlineAccountsClose"
          type="button"
          aria-label="Close ministry accounts"
        >×</button>
      </div>

      <div class="staff-inline-account-layout">
        <form id="staffInlineAccountForm">
          <h3>Create Ministry Account</h3>
          <p class="staff-password-help">
            A secure bootstrap password is generated privately and is never shown or stored by this website. Firebase emails the member a password setup link.
          </p>

          <label for="staffInlineAccountName">Full name</label>
          <input
            id="staffInlineAccountName"
            name="name"
            type="text"
            maxlength="100"
            autocomplete="name"
            placeholder="Ministry member's name"
            required
          >

          <label for="staffInlineAccountEmail">Email</label>
          <input
            id="staffInlineAccountEmail"
            name="email"
            type="email"
            maxlength="254"
            autocomplete="email"
            placeholder="member@email.com"
            required
          >

          <button class="button button-primary" type="submit">
            Create Account &amp; Send Setup Email
          </button>

          <div
            class="staff-inline-status"
            id="staffInlineAccountStatus"
            role="status"
            aria-live="polite"
          ></div>
        </form>

        <div>
          <h3>Current Ministry Accounts</h3>
          <div
            class="staff-inline-account-list"
            id="staffInlineAccountList"
            aria-live="polite"
            aria-busy="true"
          >
            <div class="staff-inline-empty">Loading accounts...</div>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(accountsModal);

  accountsClose = accountsModal.querySelector(
    "#staffInlineAccountsClose"
  );
  accountForm = accountsModal.querySelector(
    "#staffInlineAccountForm"
  );
  accountStatus = accountsModal.querySelector(
    "#staffInlineAccountStatus"
  );
  accountList = accountsModal.querySelector(
    "#staffInlineAccountList"
  );

  accountsButton.addEventListener(
    "click",
    openAccountsModal
  );
  accountsClose.addEventListener(
    "click",
    handleAccountsCloseClick
  );
  accountsModal.addEventListener(
    "click",
    handleAccountsBackdropClick
  );
  accountForm.addEventListener(
    "submit",
    handleAccountFormSubmit
  );
  document.addEventListener(
    "keydown",
    handleAccountsKeydown
  );

  subscribeToAccounts();
}


function unmountAccountManager() {
  if (accountUnsubscribe) {
    accountUnsubscribe();
    accountUnsubscribe = null;
  }

  closeAccountsModal({ restoreFocus: false });
  document.removeEventListener(
    "keydown",
    handleAccountsKeydown
  );

  accountsButton?.removeEventListener(
    "click",
    openAccountsModal
  );
  accountsClose?.removeEventListener(
    "click",
    handleAccountsCloseClick
  );
  accountsModal?.removeEventListener(
    "click",
    handleAccountsBackdropClick
  );
  accountForm?.removeEventListener(
    "submit",
    handleAccountFormSubmit
  );

  accountForm?.reset();
  accountList?.replaceChildren();
  hideStatus(accountStatus);
  accountsModal?.remove();
  accountsButton?.remove();

  accountsButton = null;
  accountsModal = null;
  accountsClose = null;
  accountForm = null;
  accountStatus = null;
  accountList = null;
  accountsReturnFocus = null;
  accountsPreviousBodyOverflow = null;
}


subscribeToContent();


onAuthStateChanged(auth, async function (user) {
  if (!user) {
    disableStaffEditing();
    return;
  }

  try {
    const profile =
      await loadStaffProfile(user);

    if (
      !profile ||
      auth.currentUser?.uid !== user.uid
    ) {
      disableStaffEditing();
      return;
    }

    enableStaffEditing(
      user,
      profile
    );
  } catch (error) {
    console.error(error);
    disableStaffEditing();
  }
});
