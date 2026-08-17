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
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";


const cardsGrid =
  document.getElementById("homeCardsGrid");

const servicesGrid =
  document.getElementById("homeServicesGrid");

const pastorShell =
  document.getElementById("homePastorShell");

const pastorName =
  document.getElementById("homePastorName");

const addButton =
  document.getElementById("homeAddButton");

const headingAdd =
  document.getElementById("homeHeadingAdd");

const editor =
  document.getElementById("homeEditor");

const editorMode =
  document.getElementById("homeEditorMode");

const editorTitle =
  document.getElementById("homeEditorTitle");

const closeButton =
  document.getElementById("homeCloseButton");

const cancelButton =
  document.getElementById("homeCancelButton");

const saveButton =
  document.getElementById("homeSaveButton");

const statusBox =
  document.getElementById("homeStatus");

const cardsHint =
  document.getElementById("homeCardsHint");

const toast =
  document.getElementById("homeToast");

let currentUser = null;
let currentCards = [];
let currentServices = [];
let toastTimer = null;
let cardsLoadFailed = false;
let servicesLoadFailed = false;


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


function safeLink(value) {
  const text =
    String(value || "").trim();

  if (!text) {
    return "";
  }

  const hasExplicitScheme =
    /^[a-z][a-z\d+.-]*:/i.test(text);

  /*
    Reject protocol-relative and backslash variants before URL parsing.
    Browsers can otherwise interpret these as cross-origin links.
  */
  if (/^[\\/]{2}/.test(text)) {
    return "";
  }

  try {
    const url =
      new URL(
        text,
        window.location.href
      );

    if (
      url.protocol !== "https:" &&
      url.protocol !== "http:"
    ) {
      return "";
    }

    if (hasExplicitScheme) {
      return url.href;
    }

    if (url.origin !== window.location.origin) {
      return "";
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch (error) {
    return "";
  }
}


function replaceWithMessage(
  container,
  className,
  message
) {
  const state =
    document.createElement("div");

  state.className =
    className;

  state.textContent =
    message;

  container.replaceChildren(state);
}


function timestampSeconds(value) {
  if (!value) {
    return 0;
  }

  if (typeof value.seconds === "number") {
    return value.seconds;
  }

  if (typeof value.toDate === "function") {
    return Math.floor(
      value.toDate().getTime() / 1000
    );
  }

  return 0;
}


function serviceDayOrder(value) {
  const day =
    String(value || "")
      .trim()
      .toLowerCase();

  const days = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday"
  ];

  const index =
    days.findIndex(function (name) {
      return day.includes(name);
    });

  return index === -1
    ? days.length
    : index;
}


function serviceTimeOrder(value) {
  const match =
    String(value || "")
      .trim()
      .match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);

  if (!match) {
    return Number.MAX_SAFE_INTEGER;
  }

  let hour =
    Number(match[1]) % 12;

  const minute =
    Number(match[2] || 0);

  if (match[3].toLowerCase() === "pm") {
    hour += 12;
  }

  return (hour * 60) + minute;
}


function createServiceCard(item) {
  const data = item.data;
  const card =
    document.createElement("article");

  card.className =
    "home-service-card";

  const tag =
    document.createElement("span");

  tag.className =
    "home-service-tag";

  tag.textContent =
    "Church Service";

  const heading =
    document.createElement("h3");

  heading.textContent =
    data.title ||
    "Church Service";

  const schedule =
    document.createElement("div");

  schedule.className =
    "home-service-schedule";

  [data.day, data.time]
    .filter(Boolean)
    .forEach(function (value) {
      const item =
        document.createElement("span");

      item.textContent = value;
      schedule.appendChild(item);
    });

  card.append(
    tag,
    heading,
    schedule
  );

  if (data.location) {
    const location =
      document.createElement("p");

    location.className =
      "home-service-location";

    location.textContent =
      data.location;

    card.appendChild(location);
  }

  if (data.details) {
    const details =
      document.createElement("p");

    details.className =
      "home-service-details";

    details.textContent =
      data.details;

    card.appendChild(details);
  }

  return card;
}


function renderServices() {
  if (!servicesGrid) {
    return;
  }

  servicesGrid.replaceChildren();

  if (servicesLoadFailed) {
    replaceWithMessage(
      servicesGrid,
      "home-services-empty",
      "Service information could not be loaded. Visit the Services page or call (702) 600-7632 for the current schedule."
    );

    return;
  }

  if (currentServices.length === 0) {
    const empty =
      document.createElement("div");

    empty.className =
      "home-services-empty";

    empty.textContent =
      "No service times are currently listed. Visit the Services page or call (702) 600-7632 for the current schedule.";

    servicesGrid.appendChild(empty);
    return;
  }

  currentServices.forEach(function (item) {
    servicesGrid.appendChild(
      createServiceCard(item)
    );
  });
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
      "Homepage Card";

    saveButton.textContent =
      "Save Changes";

    editor.elements.tag.value =
      item.data.tag || "";

    editor.elements.title.value =
      item.data.title || "";

    editor.elements.details.value =
      item.data.details || "";

    editor.elements.displayOrder.value =
      Number(item.data.displayOrder) || 1;

    editor.elements.buttonText.value =
      item.data.buttonText || "";

    editor.elements.buttonUrl.value =
      item.data.buttonUrl || "";
  } else {
    editorMode.textContent =
      "Add New";

    editorTitle.textContent =
      "Homepage Card";

    saveButton.textContent =
      "Publish Card";

    editor.elements.displayOrder.value =
      currentCards.length + 1;
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

  const accessibleTitle =
    String(
      data.title ||
      "Homepage card"
    ).trim();

  const card =
    document.createElement("article");

  card.className =
    "content-card";

  if (currentUser) {
    card.classList.add(
      "home-editable-card"
    );
  }

  const tagRow =
    document.createElement("div");

  const tag =
    document.createElement("div");

  tag.className =
    "tag";

  tag.textContent =
    data.tag ||
    "Church Update";

  tagRow.appendChild(tag);

  if (currentUser) {
    const live =
      document.createElement("span");

    live.className =
      "home-live-badge";

    live.textContent =
      "LIVE ON WEBSITE";

    tagRow.appendChild(live);
  }

  const heading =
    document.createElement("h3");

  heading.textContent =
    data.title ||
    "Untitled Card";

  const details =
    document.createElement("p");

  details.textContent =
    data.details ||
    "";

  card.append(
    tagRow,
    heading,
    details
  );

  const buttonText =
    String(data.buttonText || "").trim();

  const buttonUrl =
    safeLink(data.buttonUrl);

  if (
    buttonText &&
    buttonUrl
  ) {
    const link =
      document.createElement("a");

    link.className =
      "home-card-link";

    link.href =
      buttonUrl;

    try {
      const parsedUrl =
        new URL(
          buttonUrl,
          window.location.href
        );

      if (parsedUrl.origin !== window.location.origin) {
        link.target =
          "_blank";

        link.rel =
          "noopener noreferrer";
      }
    } catch (error) {
      // safeLink already validated this value; leave it as same-page fallback.
    }

    link.textContent =
      `${buttonText} →`;

    card.appendChild(link);
  }

  if (currentUser) {
    const actions =
      document.createElement("div");

    actions.className =
      "home-card-actions";

    const edit =
      document.createElement("button");

    edit.type =
      "button";

    edit.className =
      "home-edit-button";

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
      "home-remove-button";

    remove.textContent =
      "🗑 Remove From Homepage";

    remove.setAttribute(
      "aria-label",
      `Remove ${accessibleTitle} from the homepage`
    );

    remove.addEventListener(
      "click",
      async function () {
        const confirmed =
          window.confirm(
            `Remove "${data.title || "this card"}" from the homepage?\n\nThis cannot be undone.`
          );

        if (!confirmed) {
          return;
        }

        try {
          await deleteDoc(
            doc(db, "homeHighlights", item.id)
          );

          showToast(
            "Homepage card removed."
          );
        } catch (error) {
          console.error(error);

          showToast(
            "The homepage card could not be removed.",
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


function renderCards() {
  cardsGrid.replaceChildren();

  if (cardsLoadFailed) {
    replaceWithMessage(
      cardsGrid,
      "home-empty-state",
      "Homepage information could not be loaded. Please refresh and try again."
    );

    return;
  }

  if (currentCards.length === 0) {
    const empty =
      document.createElement("div");

    empty.className =
      "home-empty-state";

    empty.textContent =
      currentUser
        ? "No homepage cards are published. Select Add Homepage Card to create one."
        : "No homepage updates have been posted yet.";

    cardsGrid.appendChild(empty);
    return;
  }

  currentCards.forEach(function (item) {
    cardsGrid.appendChild(
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
        "Only the approved pastor can change homepage cards.",
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

    const buttonText =
      String(
        formData.get("buttonText") || ""
      ).trim();

    const buttonUrl =
      String(
        formData.get("buttonUrl") || ""
      ).trim();

    if (
      (buttonText && !buttonUrl) ||
      (!buttonText && buttonUrl)
    ) {
      showStatus(
        "For the optional button, enter both a button name and a link.",
        true
      );

      return;
    }

    if (
      buttonUrl &&
      !safeLink(buttonUrl)
    ) {
      showStatus(
        "Enter a valid page link such as services.html or a full https:// website link.",
        true
      );

      return;
    }

    const data = {
      tag:
        String(
          formData.get("tag") || ""
        ).trim(),

      title:
        String(
          formData.get("title") || ""
        ).trim(),

      details:
        String(
          formData.get("details") || ""
        ).trim(),

      displayOrder:
        Number(
          formData.get("displayOrder")
        ) || 1,

      buttonText,
      buttonUrl,

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
        await updateDoc(
          doc(db, "homeHighlights", documentId),
          data
        );

        showToast(
          "Homepage card updated."
        );
      } else {
        await addDoc(
          collection(db, "homeHighlights"),
          {
            ...data,
            createdAt:
              serverTimestamp(),
            createdBy:
              currentUser.uid
          }
        );

        showToast(
          "Homepage card published."
        );
      }

      closeEditor();
    } catch (error) {
      console.error(error);

      showStatus(
        "The homepage card could not be saved. Please refresh and try again.",
        true
      );

      showToast(
        "The homepage card could not be saved.",
        true
      );
    } finally {
      saveButton.disabled =
        false;
    }
  }
);


onSnapshot(
  collection(db, "homeHighlights"),
  function (snapshot) {
    cardsLoadFailed = false;

    currentCards =
      snapshot.docs
        .map(function (documentSnapshot) {
          return {
            id: documentSnapshot.id,
            data: documentSnapshot.data()
          };
        })
        .sort(function (a, b) {
          const orderDifference =
            (Number(a.data.displayOrder) || 999) -
            (Number(b.data.displayOrder) || 999);

          if (orderDifference !== 0) {
            return orderDifference;
          }

          return (
            timestampSeconds(a.data.createdAt) -
            timestampSeconds(b.data.createdAt)
          );
        });

    renderCards();
  },
  function (error) {
    console.error(error);
    cardsLoadFailed = true;
    currentCards = [];
    renderCards();
  }
);


onSnapshot(
  collection(db, "services"),
  function (snapshot) {
    servicesLoadFailed = false;

    currentServices =
      snapshot.docs
        .map(function (documentSnapshot) {
          return {
            id: documentSnapshot.id,
            data: documentSnapshot.data()
          };
        })
        .sort(function (a, b) {
          const dayDifference =
            serviceDayOrder(a.data.day) -
            serviceDayOrder(b.data.day);

          if (dayDifference !== 0) {
            return dayDifference;
          }

          const timeDifference =
            serviceTimeOrder(a.data.time) -
            serviceTimeOrder(b.data.time);

          if (timeDifference !== 0) {
            return timeDifference;
          }

          return String(a.data.title || "")
            .localeCompare(
              String(b.data.title || "")
            );
        });

    renderServices();
  },
  function (error) {
    console.error(error);
    servicesLoadFailed = true;
    currentServices = [];
    renderServices();
  }
);


onAuthStateChanged(
  auth,
  async function (user) {
    currentUser = null;
    pastorShell.hidden = true;
    headingAdd.hidden = true;
    pastorName.textContent = "";
    cardsHint.textContent =
      "Current services, fellowship information, and church updates.";
    closeEditor();

    if (!user) {
      renderCards();
      return;
    }

    try {
      const profile =
        await loadPastorProfile(user);

      if (auth.currentUser?.uid !== user.uid) {
        return;
      }

      if (!profile) {
        renderCards();
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

      cardsHint.textContent =
        "Pastor editing is active. Use Edit or Remove directly on a homepage card.";

      renderCards();
    } catch (error) {
      console.error(error);
      renderCards();
    }
  }
);
