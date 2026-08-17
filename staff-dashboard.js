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


const COLLECTIONS = [
  "announcements",
  "events",
  "sermons",
  "ministries"
];

const PANEL_COPY = {
  overview: {
    title: "Staff Dashboard",
    description: "Manage church website content from one simple place."
  },
  announcements: {
    title: "Announcements",
    description: "Create, edit, and remove church announcements."
  },
  events: {
    title: "Events",
    description: "Manage upcoming services, gatherings, and special events."
  },
  sermons: {
    title: "Sermons",
    description: "Publish messages, speakers, dates, and video links."
  },
  ministries: {
    title: "Ministries",
    description: "Keep church ministry information current."
  },
  accounts: {
    title: "Ministry Accounts",
    description: "Create and manage ministry website access."
  }
};

const loadingScreen = document.getElementById("dashboardLoading");
const dashboardContent = document.getElementById("dashboardContent");
const staffName = document.getElementById("staffName");
const staffRole = document.getElementById("staffRole");
const staffInitials = document.getElementById("staffInitials");
const welcomeName = document.getElementById("welcomeName");
const logoutButton = document.getElementById("logoutButton");
const pageTitle = document.getElementById("dashboardPageTitle");
const pageDescription = document.getElementById("dashboardPageDescription");
const dashboardMenuButton = document.getElementById("dashboardMenuButton");
const staffSidebarBackdrop = document.getElementById("staffSidebarBackdrop");
const ministryAccountsPanel = document.getElementById("ministryAccountsPanel");
const accountsNavButton = document.getElementById("accountsNavButton");
const accountForm = document.getElementById("ministryAccountForm");
const accountMessage = document.getElementById("accountMessage");
const ministryAccountList = document.getElementById("ministryAccountList");
const recentContentList = document.getElementById("recentContentList");
const dashboardToast = document.getElementById("dashboardToast");

const statAnnouncements = document.getElementById("statAnnouncements");
const statEvents = document.getElementById("statEvents");
const statSermons = document.getElementById("statSermons");
const statMinistries = document.getElementById("statMinistries");

const navAnnouncementCount = document.getElementById("navAnnouncementCount");
const navEventCount = document.getElementById("navEventCount");
const navSermonCount = document.getElementById("navSermonCount");
const navMinistryCount = document.getElementById("navMinistryCount");
const navAccountCount = document.getElementById("navAccountCount");

let currentUser = null;
let currentStaff = null;
let toastTimer = null;
let accountUnsubscribe = null;

const contentState = new Map(
  COLLECTIONS.map(function (collectionName) {
    return [collectionName, []];
  })
);


function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}


function isStrongTemporaryPassword(value) {
  const password = String(value || "");

  return password.length >= 12
    && password.length <= 128
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password);
}


function createBootstrapPassword() {
  const lowercase =
    "abcdefghijkmnopqrstuvwxyz";

  const uppercase =
    "ABCDEFGHJKLMNPQRSTUVWXYZ";

  const digits =
    "23456789";

  const all =
    lowercase + uppercase + digits;

  const randomIndex = function (maximum) {
    const values =
      new Uint32Array(1);

    crypto.getRandomValues(values);

    return values[0] % maximum;
  };

  const characters = [
    lowercase[randomIndex(lowercase.length)],
    uppercase[randomIndex(uppercase.length)],
    digits[randomIndex(digits.length)]
  ];

  while (characters.length < 32) {
    characters.push(
      all[randomIndex(all.length)]
    );
  }

  for (
    let index = characters.length - 1;
    index > 0;
    index -= 1
  ) {
    const swapIndex =
      randomIndex(index + 1);

    [
      characters[index],
      characters[swapIndex]
    ] = [
      characters[swapIndex],
      characters[index]
    ];
  }

  const password =
    characters.join("");

  if (!isStrongTemporaryPassword(password)) {
    throw new Error(
      "Secure bootstrap password generation failed."
    );
  }

  return password;
}


function getInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "SM";
  }

  return parts
    .map(function (part) {
      return part.charAt(0).toUpperCase();
    })
    .join("");
}


function showToast(message, isError = false) {
  if (!dashboardToast) {
    return;
  }

  window.clearTimeout(toastTimer);

  dashboardToast.textContent = message;
  dashboardToast.classList.toggle("error", isError);
  dashboardToast.classList.add("show");

  toastTimer = window.setTimeout(function () {
    dashboardToast.classList.remove("show");
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


function closeMobileSidebar() {
  document.body.classList.remove("staff-sidebar-open");

  if (dashboardMenuButton) {
    dashboardMenuButton.setAttribute("aria-expanded", "false");
  }
}


function openTab(tabName, options = {}) {
  const copy = PANEL_COPY[tabName] || PANEL_COPY.overview;

  document.querySelectorAll("[data-tab]").forEach(function (button) {
    const isActive = button.dataset.tab === tabName;

    button.classList.toggle("active", isActive);
    button.setAttribute(
      "aria-selected",
      String(isActive)
    );
    button.tabIndex = isActive ? 0 : -1;

    if (isActive) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  document.querySelectorAll("[data-panel]").forEach(function (panel) {
    panel.hidden = panel.dataset.panel !== tabName;
  });

  if (pageTitle) {
    pageTitle.textContent = copy.title;
  }

  if (pageDescription) {
    pageDescription.textContent = copy.description;
  }

  closeMobileSidebar();

  if (options.scroll !== false) {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }
}


document.querySelectorAll("[data-tab]").forEach(function (button) {
  button.addEventListener("click", function () {
    openTab(button.dataset.tab);
  });

  button.addEventListener("keydown", function (event) {
    const tabs = Array.from(
      document.querySelectorAll("[data-tab]")
    );
    const currentIndex = tabs.indexOf(button);
    let nextIndex = currentIndex;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = tabs.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextTab = tabs[nextIndex];
    openTab(nextTab.dataset.tab, { scroll: false });
    nextTab.focus();
  });
});


document.querySelectorAll("[data-open-tab]").forEach(function (button) {
  button.addEventListener("click", function () {
    openTab(button.dataset.openTab);
  });
});


if (dashboardMenuButton) {
  dashboardMenuButton.addEventListener("click", function () {
    const isOpen = document.body.classList.toggle("staff-sidebar-open");
    dashboardMenuButton.setAttribute("aria-expanded", String(isOpen));
  });
}


if (staffSidebarBackdrop) {
  staffSidebarBackdrop.addEventListener("click", closeMobileSidebar);
}


document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeMobileSidebar();
  }
});


if (logoutButton) {
  logoutButton.addEventListener("click", async function () {
    logoutButton.disabled = true;

    try {
      await signOut(auth);
      window.location.href = "staff-login.html";
    } catch (error) {
      console.error(error);
      logoutButton.disabled = false;
      showToast("Could not sign out. Please try again.", true);
    }
  });
}


async function loadStaffProfile(user) {
  const snapshot = await getDoc(
    doc(db, "staff", user.uid)
  );

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();
  const role = normalizeRole(data.role);

  if (
    data.active !== true ||
    !["pastor", "ministry"].includes(role)
  ) {
    return null;
  }

  return {
    ...data,
    role
  };
}


function getItemTitle(collectionName, data) {
  if (collectionName === "ministries") {
    return data.name || "Untitled Ministry";
  }

  return data.title || "Untitled";
}


function getItemMeta(collectionName, data) {
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


function getCollectionLabel(collectionName) {
  const labels = {
    announcements: "Announcement",
    events: "Event",
    sermons: "Sermon",
    ministries: "Ministry"
  };

  return labels[collectionName] || collectionName;
}


function timestampSeconds(value) {
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


function documentSortTime(data) {
  return Math.max(
    timestampSeconds(data.updatedAt),
    timestampSeconds(data.createdAt)
  );
}


function formatValue(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString().slice(0, 10);
  }

  return String(value);
}


function getFormForCollection(collectionName) {
  return document.querySelector(
    `[data-content-form="${collectionName}"]`
  );
}


function clearEditingState(form) {
  form.reset();

  if (form.elements.documentId) {
    form.elements.documentId.value = "";
  }

  const submitButton = form.querySelector('[type="submit"]');
  const cancelButton = form.querySelector("[data-cancel-edit]");

  if (submitButton) {
    submitButton.textContent =
      submitButton.dataset.defaultText || "Publish";
  }

  if (cancelButton) {
    cancelButton.hidden = true;
  }
}


document.querySelectorAll("[data-cancel-edit]").forEach(function (button) {
  button.addEventListener("click", function () {
    const form = button.closest("form");

    if (!form) {
      return;
    }

    clearEditingState(form);
    hideStatus(form.querySelector(".staff-form-status"));
  });
});


document.querySelectorAll("[data-content-form]").forEach(function (form) {
  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!currentUser) {
      showToast("Your session is no longer active. Please sign in again.", true);
      return;
    }

    const collectionName = form.dataset.contentForm;
    const status = form.querySelector(".staff-form-status");
    const submitButton = form.querySelector('[type="submit"]');
    const formData = new FormData(form);
    const documentId = String(
      formData.get("documentId") || ""
    ).trim();

    const data = {};

    for (const [key, value] of formData.entries()) {
      if (key === "documentId") {
        continue;
      }

      data[key] = String(value).trim();
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = documentId
        ? "Saving Changes…"
        : "Publishing…";
    }

    hideStatus(status);

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

        clearEditingState(form);
        showStatus(status, "Changes saved successfully.");
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

        clearEditingState(form);
        showStatus(status, "Published successfully.");
        showToast(`${getCollectionLabel(collectionName)} published.`);
      }
    } catch (error) {
      console.error(error);

      showStatus(
        status,
        "This item could not be saved. Check your connection and try again.",
        true
      );

      showToast("The item could not be saved.", true);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;

        if (!form.elements.documentId?.value) {
          submitButton.textContent =
            submitButton.dataset.defaultText || "Publish";
        }
      }
    }
  });
});


function startEditing(collectionName, documentId, data) {
  const form = getFormForCollection(collectionName);

  if (!form) {
    return;
  }

  openTab(collectionName, {
    scroll: false
  });

  form.elements.documentId.value = documentId;

  Object.entries(data).forEach(function ([key, value]) {
    if (form.elements[key]) {
      form.elements[key].value = formatValue(value);
    }
  });

  const submitButton = form.querySelector('[type="submit"]');
  const cancelButton = form.querySelector("[data-cancel-edit]");

  if (submitButton) {
    submitButton.textContent = "Save Changes";
  }

  if (cancelButton) {
    cancelButton.hidden = false;
  }

  hideStatus(form.querySelector(".staff-form-status"));

  form.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

  const firstInput = form.querySelector(
    'input:not([type="hidden"]), textarea'
  );

  window.setTimeout(function () {
    firstInput?.focus({
      preventScroll: true
    });
  }, 350);
}


async function removeContent(collectionName, documentId, title) {
  const confirmed = window.confirm(
    `Remove "${title || "this item"}" from the website?`
  );

  if (!confirmed) {
    return;
  }

  try {
    await deleteDoc(
      doc(db, collectionName, documentId)
    );

    showToast(`${getCollectionLabel(collectionName)} removed.`);
  } catch (error) {
    console.error(error);

    window.alert(
      "The item could not be removed. Please refresh and try again."
    );
  }
}


function createManageItem(collectionName, item) {
  const card = document.createElement("article");
  card.className = "staff-manage-item";

  const head = document.createElement("div");
  head.className = "staff-manage-head";

  const copy = document.createElement("div");
  copy.className = "staff-manage-copy";

  const title = document.createElement("h3");
  title.textContent = getItemTitle(
    collectionName,
    item.data
  );

  const meta = document.createElement("span");
  meta.className = "staff-manage-meta";
  meta.textContent =
    getItemMeta(collectionName, item.data) ||
    getCollectionLabel(collectionName);

  const details = document.createElement("p");
  details.textContent =
    item.data.details ||
    item.data.description ||
    "No details provided.";

  copy.append(title, meta, details);

  const badge = document.createElement("span");
  badge.className = "staff-content-type";
  badge.textContent = getCollectionLabel(collectionName);

  head.append(copy, badge);

  const actions = document.createElement("div");
  actions.className = "staff-manage-actions";

  const editButton = document.createElement("button");
  editButton.className = "staff-small-button edit";
  editButton.type = "button";
  editButton.textContent = "Edit";
  editButton.addEventListener("click", function () {
    startEditing(
      collectionName,
      item.id,
      item.data
    );
  });

  const removeButton = document.createElement("button");
  removeButton.className = "staff-small-button remove";
  removeButton.type = "button";
  removeButton.textContent = "Remove";
  removeButton.addEventListener("click", function () {
    removeContent(
      collectionName,
      item.id,
      getItemTitle(collectionName, item.data)
    );
  });

  actions.append(editButton, removeButton);
  card.append(head, actions);

  return card;
}


function renderManageList(collectionName, items) {
  const container = document.querySelector(
    `[data-manage-list="${collectionName}"]`
  );

  if (!container) {
    return;
  }

  container.replaceChildren();

  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "staff-empty-state";
    empty.textContent = `No ${collectionName} have been published yet.`;
    container.appendChild(empty);
    return;
  }

  items.forEach(function (item) {
    container.appendChild(
      createManageItem(collectionName, item)
    );
  });
}


function countUpcomingEvents(items) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return items.filter(function (item) {
    const dateValue = item.data.date;

    if (!dateValue) {
      return false;
    }

    const typedDate = String(dateValue).trim();
    const eventDate = /^\d{4}-\d{2}-\d{2}$/.test(typedDate)
      ? new Date(`${typedDate}T00:00:00`)
      : new Date(typedDate);

    eventDate.setHours(0, 0, 0, 0);

    return (
      !Number.isNaN(eventDate.getTime()) &&
      eventDate >= today
    );
  }).length;
}


function updateOverviewCounts() {
  const announcements =
    contentState.get("announcements") || [];
  const events =
    contentState.get("events") || [];
  const sermons =
    contentState.get("sermons") || [];
  const ministries =
    contentState.get("ministries") || [];

  statAnnouncements.textContent = announcements.length;
  statEvents.textContent = countUpcomingEvents(events);
  statSermons.textContent = sermons.length;
  statMinistries.textContent = ministries.length;

  navAnnouncementCount.textContent = announcements.length;
  navEventCount.textContent = events.length;
  navSermonCount.textContent = sermons.length;
  navMinistryCount.textContent = ministries.length;
}


function renderRecentContent() {
  if (!recentContentList) {
    return;
  }

  const recentItems = [];

  contentState.forEach(function (items, collectionName) {
    items.forEach(function (item) {
      recentItems.push({
        ...item,
        collectionName
      });
    });
  });

  recentItems.sort(function (a, b) {
    return (
      documentSortTime(b.data) -
      documentSortTime(a.data)
    );
  });

  recentContentList.replaceChildren();

  if (recentItems.length === 0) {
    const empty = document.createElement("div");
    empty.className = "staff-empty-state";
    empty.textContent = "Published content will appear here.";
    recentContentList.appendChild(empty);
    return;
  }

  recentItems.slice(0, 6).forEach(function (item) {
    const button = document.createElement("button");
    button.className = "staff-recent-item";
    button.type = "button";

    const copy = document.createElement("span");
    copy.className = "staff-recent-item-copy";

    const title = document.createElement("strong");
    title.textContent = getItemTitle(
      item.collectionName,
      item.data
    );

    const meta = document.createElement("small");
    meta.textContent =
      getItemMeta(item.collectionName, item.data) ||
      getCollectionLabel(item.collectionName);

    const badge = document.createElement("span");
    badge.className = "staff-content-type";
    badge.textContent = getCollectionLabel(
      item.collectionName
    );

    copy.append(title, meta);
    button.append(copy, badge);

    button.addEventListener("click", function () {
      openTab(item.collectionName);
    });

    recentContentList.appendChild(button);
  });
}


function subscribeToContent() {
  COLLECTIONS.forEach(function (collectionName) {
    onSnapshot(
      collection(db, collectionName),
      function (snapshot) {
        const items = snapshot.docs
          .map(function (documentSnapshot) {
            return {
              id: documentSnapshot.id,
              data: documentSnapshot.data()
            };
          })
          .sort(function (a, b) {
            return (
              documentSortTime(b.data) -
              documentSortTime(a.data)
            );
          });

        contentState.set(collectionName, items);

        renderManageList(
          collectionName,
          items
        );

        updateOverviewCounts();
        renderRecentContent();
      },
      function (error) {
        console.error(error);

        const container = document.querySelector(
          `[data-manage-list="${collectionName}"]`
        );

        if (container) {
          container.innerHTML =
            '<div class="staff-empty-state">This content could not be loaded.</div>';
        }
      }
    );
  });
}


function renderMinistryAccounts(snapshot) {
  if (!ministryAccountList) {
    return;
  }

  ministryAccountList.replaceChildren();

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

  const activeAccounts = accounts.filter(function (account) {
    return account.data.active === true;
  }).length;

  navAccountCount.textContent = activeAccounts;

  if (accounts.length === 0) {
    const empty = document.createElement("div");
    empty.className = "staff-empty-state";
    empty.textContent = "No ministry accounts have been added yet.";
    ministryAccountList.appendChild(empty);
    return;
  }

  accounts.forEach(function (account) {
    const card = document.createElement("article");
    card.className = "staff-manage-item";

    const head = document.createElement("div");
    head.className = "staff-manage-head";

    const copy = document.createElement("div");
    copy.className = "staff-manage-copy";

    const title = document.createElement("h3");
    title.textContent =
      account.data.name ||
      "Ministry Member";

    const email = document.createElement("span");
    email.className = "staff-manage-meta";
    email.textContent =
      account.data.email ||
      "No email listed";

    copy.append(title, email);

    const badge = document.createElement("span");
    badge.className =
      account.data.active === true
        ? "staff-account-status active"
        : "staff-account-status inactive";

    badge.textContent =
      account.data.active === true
        ? "Active"
        : "Access Removed";

    head.append(copy, badge);

    const actions = document.createElement("div");
    actions.className = "staff-manage-actions";

    const resetButton = document.createElement("button");
    resetButton.type = "button";
    resetButton.className = "staff-small-button edit";
    resetButton.textContent = "Send Password Reset";
    resetButton.disabled = !account.data.email;

    resetButton.addEventListener("click", async function () {
      const emailAddress = String(account.data.email || "").trim();

      if (!emailAddress) {
        return;
      }

      const confirmed = window.confirm(
        `Send a Firebase password-reset email to ${emailAddress}?`
      );

      if (!confirmed) {
        return;
      }

      resetButton.disabled = true;

      try {
        await sendPasswordResetEmail(auth, emailAddress);
        showToast("Password-reset email sent.");
      } catch (error) {
        console.error("Ministry password reset failed:", error);
        window.alert(
          "The password-reset email could not be sent. Check the address and try again."
        );
      } finally {
        resetButton.disabled = false;
      }
    });

    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.className =
      account.data.active === true
        ? "staff-small-button remove"
        : "staff-small-button edit";

    toggleButton.textContent =
      account.data.active === true
        ? "Remove Access"
        : "Restore Access";

    toggleButton.addEventListener("click", async function () {
      const nextActive =
        account.data.active !== true;

      const actionWord =
        nextActive ? "Restore" : "Remove";

      const confirmed = window.confirm(
        `${actionWord} access for ${
          account.data.name ||
          account.data.email ||
          "this account"
        }?`
      );

      if (!confirmed) {
        return;
      }

      toggleButton.disabled = true;

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
        window.alert("The account could not be updated.");
      } finally {
        toggleButton.disabled = false;
      }
    });

    actions.append(resetButton, toggleButton);
    card.append(head, actions);
    ministryAccountList.appendChild(card);
  });
}


function subscribeToMinistryAccounts() {
  if (accountUnsubscribe) {
    accountUnsubscribe();
  }

  accountUnsubscribe = onSnapshot(
    collection(db, "staff"),
    renderMinistryAccounts,
    function (error) {
      console.error(error);

      showStatus(
        accountMessage,
        "Could not load ministry accounts.",
        true
      );
    }
  );
}


if (accountForm) {
  accountForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (currentStaff?.role !== "pastor") {
      showStatus(
        accountMessage,
        "Only the pastor can add ministry accounts.",
        true
      );

      return;
    }

    const name = document
      .getElementById("ministryName")
      .value
      .trim();

    const email = document
      .getElementById("ministryEmail")
      .value
      .trim()
      .toLowerCase();

    const password =
      createBootstrapPassword();

    const submitButton =
      accountForm.querySelector('[type="submit"]');

    let secondaryApp = null;
    let createdUser = null;
    let staffRecordCreated = false;

    submitButton.disabled = true;
    submitButton.textContent = "Creating Account…";
    hideStatus(accountMessage);

    try {
      secondaryApp = initializeApp(
        firebaseConfig,
        `ministry-account-${Date.now()}`
      );

      const secondaryAuth =
        getAuth(secondaryApp);

      const credential =
        await createUserWithEmailAndPassword(
          secondaryAuth,
          email,
          password
        );

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
          createdBy: currentUser.uid,
          updatedBy: currentUser.uid
        }
      );

      staffRecordCreated = true;

      await signOut(secondaryAuth);

      let resetEmailSent = true;

      try {
        await sendPasswordResetEmail(
          auth,
          email
        );
      } catch (resetError) {
        resetEmailSent = false;

        console.error(
          "Ministry password setup email failed:",
          resetError
        );
      }

      accountForm.reset();

      showStatus(
        accountMessage,
        resetEmailSent
          ? "Ministry account created. Firebase sent the member a secure password-setup email."
          : "Ministry account created, but the password-setup email could not be sent. Use Send Password Reset beside the account to try again.",
        !resetEmailSent
      );

      showToast(
        resetEmailSent
          ? "Ministry account created and setup email sent."
          : "Account created; setup email needs to be resent.",
        !resetEmailSent
      );
    } catch (error) {
      console.error(error);

      if (
        createdUser &&
        !staffRecordCreated
      ) {
        try {
          await deleteUser(createdUser);
        } catch (cleanupError) {
          console.error(cleanupError);
        }
      }

      let message =
        "The ministry account could not be created.";

      if (error.code === "auth/email-already-in-use") {
        message =
          "An account already exists with that email address.";
      } else if (error.code === "auth/weak-password") {
        message =
          "Firebase rejected the secure bootstrap password. Review the Firebase password policy.";
      } else if (error.code === "auth/invalid-email") {
        message =
          "Enter a valid email address.";
      } else if (
        error.code === "permission-denied" ||
        error.code === "firestore/permission-denied"
      ) {
        message =
          "The ministry account could not be created. Please review staff access and try again.";
      }

      showStatus(
        accountMessage,
        message,
        true
      );

      showToast(message, true);
    } finally {
      if (secondaryApp) {
        try {
          await deleteApp(secondaryApp);
        } catch (error) {
          console.error(error);
        }
      }

      submitButton.disabled = false;
      submitButton.textContent =
        "Create Ministry Account";
    }
  });
}


function configureRoleAccess(profile) {
  const isPastor =
    profile.role === "pastor";

  if (isPastor) {
    accountsNavButton.hidden = false;
    ministryAccountsPanel.hidden = true;

    document
      .querySelectorAll(".pastor-only-action")
      .forEach(function (element) {
        element.hidden = false;
      });

    subscribeToMinistryAccounts();
  } else {
    accountsNavButton.remove();

    document
      .querySelectorAll(".pastor-only-action")
      .forEach(function (element) {
        element.remove();
      });

    ministryAccountsPanel.remove();
  }
}


onAuthStateChanged(auth, async function (user) {
  if (!user) {
    window.location.href = "staff-login.html";
    return;
  }

  try {
    const profile =
      await loadStaffProfile(user);

    if (!profile) {
      await signOut(auth);
      window.location.href =
        "staff-login.html?error=access";
      return;
    }

    currentUser = user;
    currentStaff = profile;

    const displayName =
      profile.name ||
      user.email ||
      "Staff Member";

    staffName.textContent = displayName;
    staffRole.textContent =
      profile.role === "pastor"
        ? "Pastor"
        : "Ministry";

    welcomeName.textContent =
      String(displayName).split(" ")[0];

    staffInitials.textContent =
      getInitials(displayName);

    configureRoleAccess(profile);
    subscribeToContent();

    loadingScreen.hidden = true;
    dashboardContent.hidden = false;

    openTab("overview", {
      scroll: false
    });
  } catch (error) {
    console.error(error);

    try {
      await signOut(auth);
    } catch (signOutError) {
      console.error(signOutError);
    }

    window.location.href =
      "staff-login.html?error=access";
  }
});
