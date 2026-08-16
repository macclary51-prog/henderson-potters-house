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
const accountsButton = document.getElementById("staffInlineAccountsButton");
const editor = document.getElementById("staffInlineEditor");
const editorForm = document.getElementById("staffInlineForm");
const formMode = document.getElementById("staffInlineFormMode");
const formTitle = document.getElementById("staffInlineFormTitle");
const saveButton = document.getElementById("staffInlineSaveButton");
const cancelButton = document.getElementById("staffInlineCancelButton");
const closeButton = document.getElementById("staffInlineCloseButton");
const formStatus = document.getElementById("staffInlineStatus");
const toast = document.getElementById("staffInlineToast");

const accountsModal = document.getElementById("staffInlineAccountsModal");
const accountsClose = document.getElementById("staffInlineAccountsClose");
const accountForm = document.getElementById("staffInlineAccountForm");
const accountStatus = document.getElementById("staffInlineAccountStatus");
const accountList = document.getElementById("staffInlineAccountList");

let currentUser = null;
let currentStaff = null;
let currentItems = [];
let accountUnsubscribe = null;
let toastTimer = null;


function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
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
    accountsButton.hidden = false;
    subscribeToAccounts();
  }

  renderItems();
}


function disableStaffEditing() {
  currentUser = null;
  currentStaff = null;

  if (staffShell) {
    staffShell.hidden = true;
  }

  if (headingAddButton) {
    headingAddButton.hidden = true;
  }

  if (accountsButton) {
    accountsButton.hidden = true;
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

    if (
      parsed.hostname === "youtu.be" ||
      parsed.hostname === "www.youtu.be"
    ) {
      videoId =
        parsed.pathname
          .split("/")
          .filter(Boolean)[0] || "";
    } else if (
      parsed.hostname.includes("youtube.com")
    ) {
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

  contentGrid.replaceChildren();

  if (currentItems.length === 0) {
    const empty = createTextElement(
      "div",
      "empty-state",
      `No ${collectionName} have been published yet.`
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

      contentGrid.innerHTML =
        '<div class="empty-state">Church information could not be loaded.</div>';
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
  if (!accountsModal) {
    return;
  }

  accountsModal.hidden = false;
  document.body.style.overflow = "hidden";
}


function closeAccountsModal() {
  if (!accountsModal) {
    return;
  }

  accountsModal.hidden = true;
  document.body.style.overflow = "";
  hideStatus(accountStatus);
}


if (accountsButton) {
  accountsButton.addEventListener("click", openAccountsModal);
}


if (accountsClose) {
  accountsClose.addEventListener("click", closeAccountsModal);
}


if (accountsModal) {
  accountsModal.addEventListener("click", function (event) {
    if (event.target === accountsModal) {
      closeAccountsModal();
    }
  });
}


document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeAccountsModal();
  }
});


function renderAccounts(snapshot) {
  if (!accountList) {
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
  if (accountUnsubscribe) {
    accountUnsubscribe();
  }

  accountUnsubscribe = onSnapshot(
    collection(db, "staff"),
    renderAccounts,
    function (error) {
      console.error(error);

      if (accountList) {
        accountList.innerHTML =
          '<div class="staff-inline-empty">Accounts could not be loaded.</div>';
      }
    }
  );
}


if (accountForm) {
  accountForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (currentStaff?.role !== "pastor") {
      showStatus(
        accountStatus,
        "Only the pastor can create ministry accounts.",
        true
      );

      return;
    }

    const name = document
      .getElementById("staffInlineAccountName")
      .value
      .trim();

    const email = document
      .getElementById("staffInlineAccountEmail")
      .value
      .trim()
      .toLowerCase();

    const password = document
      .getElementById("staffInlineAccountPassword")
      .value;

    const submitButton =
      accountForm.querySelector('[type="submit"]');

    let secondaryApp = null;
    let createdUser = null;

    submitButton.disabled = true;
    submitButton.textContent = "Creating Account...";
    hideStatus(accountStatus);

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

      await signOut(secondaryAuth);

      accountForm.reset();

      showStatus(
        accountStatus,
        "Ministry account created successfully."
      );

      showToast("Ministry account created.");
    } catch (error) {
      console.error(error);

      if (createdUser) {
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
          "The temporary password must contain at least 6 characters.";
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

      showStatus(
        accountStatus,
        message,
        true
      );

      showToast(
        message,
        true
      );
    } finally {
      if (secondaryApp) {
        try {
          await deleteApp(secondaryApp);
        } catch (error) {
          console.error(error);
        }
      }

      submitButton.disabled = false;
      submitButton.textContent = "Create Account";
    }
  });
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

    if (!profile) {
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
