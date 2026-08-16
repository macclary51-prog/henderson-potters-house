import {
  auth,
  db
} from "./firebase-config.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";


const requestForm =
  document.getElementById("prayerRequestForm");

const submitButton =
  document.getElementById("prayerSubmitButton");

const formStatus =
  document.getElementById("prayerFormStatus");

const staffShell =
  document.getElementById("prayerStaffShell");

const staffName =
  document.getElementById("prayerStaffName");

const staffRole =
  document.getElementById("prayerStaffRole");

const staffInitials =
  document.getElementById("prayerStaffInitials");

const signOutButton =
  document.getElementById("prayerSignOutButton");


const requestList =
  document.getElementById("prayerRequestList");

const countLabel =
  document.getElementById("prayerCount");

const loadMoreButton =
  document.getElementById("prayerLoadMoreButton");

const toast =
  document.getElementById("prayerToast");

let currentUser = null;
let currentStaff = null;
let currentRequests = [];
let hasMoreRequests = false;
let requestUnsubscribe = null;
let toastTimer = null;

const REQUEST_PAGE_SIZE = 50;
let requestLimit = REQUEST_PAGE_SIZE;


function cleanText(value) {
  return String(value || "").trim();
}


function normalizeRole(role) {
  return cleanText(role).toLowerCase();
}


function getInitials(name) {
  const parts =
    cleanText(name)
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


function showFormStatus(message, isError = false) {
  formStatus.textContent = message;
  formStatus.classList.toggle("error", isError);
  formStatus.style.display = "block";
}


function hideFormStatus() {
  formStatus.textContent = "";
  formStatus.classList.remove("error");
  formStatus.style.display = "none";
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


function formatDate(timestamp) {
  if (
    !timestamp ||
    typeof timestamp.toDate !== "function"
  ) {
    return "Just submitted";
  }

  return timestamp
    .toDate()
    .toLocaleString(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
      }
    );
}


function statusLabel(status) {
  if (status === "praying") {
    return "Praying";
  }

  if (status === "completed") {
    return "Completed";
  }

  return "New";
}


function createBadge(text, className) {
  const badge =
    document.createElement("span");

  badge.className =
    `prayer-badge ${className}`;

  badge.textContent =
    text;

  return badge;
}


function createActionButton({
  text,
  className,
  onClick
}) {
  const button =
    document.createElement("button");

  button.type =
    "button";

  button.className =
    className;

  button.textContent =
    text;

  button.addEventListener(
    "click",
    async function () {
      button.disabled = true;

      try {
        await onClick();
      } finally {
        button.disabled = false;
      }
    }
  );

  return button;
}


async function deletePrayerRequest(item) {
  const requester =
    cleanText(item.data.name) ||
    "Anonymous";

  const confirmed =
    window.confirm(
      `Permanently remove the prayer request from ${requester}?\n\nThis cannot be undone.`
    );

  if (!confirmed) {
    return;
  }

  try {
    await deleteDoc(
      doc(db, "prayerRequests", item.id)
    );

    showToast(
      "Prayer request removed."
    );
  } catch (error) {
    console.error(error);

    showToast(
      "The prayer request could not be removed.",
      true
    );
  }
}


function createRequestCard(item) {
  const data =
    item.data;

  const card =
    document.createElement("article");

  card.className =
    "prayer-request-card";

  const head =
    document.createElement("div");

  head.className =
    "prayer-request-head";

  const person =
    document.createElement("div");

  person.className =
    "prayer-request-person";

  const name =
    document.createElement("strong");

  name.textContent =
    cleanText(data.name) ||
    "Anonymous";

  const date =
    document.createElement("small");

  date.textContent =
    formatDate(data.createdAt);

  person.append(
    name,
    date
  );

  const badges =
    document.createElement("div");

  badges.className =
    "prayer-request-badges";

  if (data.confidential === true) {
    badges.appendChild(
      createBadge(
        "Confidential",
        "confidential"
      )
    );
  }

  head.append(
    person,
    badges
  );

  const prayerText =
    document.createElement("p");

  prayerText.className =
    "prayer-request-text";

  prayerText.textContent =
    cleanText(data.prayerText);

  card.append(
    head,
    prayerText
  );

  const contact =
    cleanText(data.contact);

  if (contact) {
    const contactBox =
      document.createElement("div");

    contactBox.className =
      "prayer-contact";

    const contactLabel =
      document.createElement("strong");

    contactLabel.textContent =
      "Contact:";

    const contactText =
      document.createElement("span");

    contactText.textContent =
      contact;

    contactBox.append(
      contactLabel,
      contactText
    );

    card.appendChild(
      contactBox
    );
  }

  const actions =
    document.createElement("div");

  actions.className =
    "prayer-card-actions";

  const deleteButton =
    document.createElement("button");

  deleteButton.type =
    "button";

  deleteButton.className =
    "prayer-action-delete";

  deleteButton.textContent =
    "Remove Prayer Request";

  deleteButton.addEventListener(
    "click",
    async function () {
      deleteButton.disabled = true;

      try {
        await deletePrayerRequest(item);
      } finally {
        deleteButton.disabled = false;
      }
    }
  );

  actions.appendChild(
    deleteButton
  );

  card.appendChild(
    actions
  );

  return card;
}


function renderRequests() {
  requestList.replaceChildren();

  countLabel.textContent = hasMoreRequests
    ? `${currentRequests.length}+ requests loaded`
    : `${currentRequests.length} ${
        currentRequests.length === 1
          ? "request"
          : "requests"
      }`;

  if (loadMoreButton) {
    const moveFocus =
      !hasMoreRequests
      && document.activeElement ===
        loadMoreButton;

    loadMoreButton.hidden =
      !hasMoreRequests;

    if (moveFocus) {
      countLabel.focus();
    }
  }

  if (currentRequests.length === 0) {
    const empty =
      document.createElement("div");

    empty.className =
      "prayer-empty";

    empty.textContent =
      "No prayer requests have been submitted yet.";

    requestList.appendChild(
      empty
    );

    return;
  }

  currentRequests.forEach(function (item) {
    requestList.appendChild(
      createRequestCard(item)
    );
  });
}


function loadOlderRequests() {
  if (!loadMoreButton) {
    return;
  }

  loadMoreButton.disabled = true;
  loadMoreButton.textContent =
    "Loading...";

  requestLimit += REQUEST_PAGE_SIZE;
  subscribeToRequests(true);
}


function subscribeToRequests(isLoadingMore = false) {
  if (requestUnsubscribe) {
    requestUnsubscribe();
  }

  requestUnsubscribe =
    onSnapshot(
      query(
        collection(db, "prayerRequests"),
        orderBy("createdAt", "desc"),
        limit(requestLimit + 1)
      ),
      function (snapshot) {
        hasMoreRequests =
          snapshot.docs.length >
          requestLimit;

        currentRequests =
          snapshot.docs
            .slice(0, requestLimit)
            .map(
            function (documentSnapshot) {
              return {
                id: documentSnapshot.id,
                data: documentSnapshot.data()
              };
            }
          );

        renderRequests();

        if (isLoadingMore && loadMoreButton) {
          loadMoreButton.disabled = false;
          loadMoreButton.textContent =
            "Load Older Requests";
        }
      },
      function (error) {
        console.error(error);

        if (isLoadingMore) {
          requestLimit = Math.max(
            REQUEST_PAGE_SIZE,
            requestLimit - REQUEST_PAGE_SIZE
          );

          if (loadMoreButton) {
            loadMoreButton.disabled = false;
            loadMoreButton.textContent =
              "Load Older Requests";
          }

          showToast(
            "Older prayer requests could not be loaded.",
            true
          );

          subscribeToRequests();
        } else {
          requestList.innerHTML =
            '<div class="prayer-empty">Prayer requests could not be loaded. Refresh the page and try again.</div>';
        }
      }
    );
}


async function loadStaffProfile(user) {
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
    !["pastor", "ministry"].includes(role)
  ) {
    return null;
  }

  return {
    ...profile,
    role
  };
}


function enableStaffInbox(user, profile) {
  currentUser =
    user;

  currentStaff =
    profile;

  const displayName =
    profile.name ||
    user.email ||
    "Staff Member";

  staffName.textContent =
    displayName;

  staffRole.textContent =
    profile.role === "pastor"
      ? "Pastor"
      : "Ministry";

  staffInitials.textContent =
    getInitials(displayName);

  staffShell.hidden =
    false;

  subscribeToRequests();
}


function disableStaffInbox() {
  currentUser =
    null;

  currentStaff =
    null;

  staffShell.hidden =
    true;

  currentRequests =
    [];

  requestLimit = REQUEST_PAGE_SIZE;
  hasMoreRequests = false;

  if (loadMoreButton) {
    loadMoreButton.hidden = true;
  }

  if (requestUnsubscribe) {
    requestUnsubscribe();
    requestUnsubscribe = null;
  }
}


requestForm.addEventListener(
  "submit",
  async function (event) {
    event.preventDefault();
    hideFormStatus();

    const name =
      cleanText(
        requestForm.elements.name.value
      );

    const contact =
      cleanText(
        requestForm.elements.contact.value
      );

    const prayerText =
      cleanText(
        requestForm.elements.prayerText.value
      );

    const confidential =
      requestForm.elements.confidential.checked;

    const honeypot =
      cleanText(
        requestForm.elements.website.value
      );

    /*
      Silently accept likely automated spam without writing it.
    */
    if (honeypot) {
      requestForm.reset();

      showFormStatus(
        "Your prayer request was submitted."
      );

      return;
    }

    if (
      prayerText.length < 5 ||
      prayerText.length > 3000
    ) {
      showFormStatus(
        "Enter a prayer request between 5 and 3,000 characters.",
        true
      );

      requestForm.elements.prayerText.focus();
      return;
    }

    if (
      name.length > 100 ||
      contact.length > 150
    ) {
      showFormStatus(
        "Keep your name under 100 characters and contact information under 150 characters.",
        true
      );

      return;
    }

    const lastSubmission =
      Number(
        localStorage.getItem(
          "lastPrayerRequestSubmission"
        ) || 0
      );

    if (
      Date.now() - lastSubmission <
      30000
    ) {
      showFormStatus(
        "Please wait a moment before submitting another request.",
        true
      );

      return;
    }

    submitButton.disabled =
      true;

    submitButton.textContent =
      "Submitting...";

    try {
      await addDoc(
        collection(db, "prayerRequests"),
        {
          name,
          contact,
          prayerText,
          confidential,
          status: "new",
          source: "website",
          createdAt:
            serverTimestamp()
        }
      );

      localStorage.setItem(
        "lastPrayerRequestSubmission",
        String(Date.now())
      );

      requestForm.reset();

      showFormStatus(
        "Your prayer request was submitted successfully."
      );
    } catch (error) {
      console.error(error);

      let message =
        "The prayer request could not be submitted.";

      if (
        error.code === "permission-denied" ||
        error.code === "firestore/permission-denied"
      ) {
        message =
          "The prayer request service is not ready yet. Please try again shortly.";
      } else if (
        error.code === "unavailable" ||
        error.code === "firestore/unavailable"
      ) {
        message =
          "The prayer request service is temporarily unavailable. Check your connection and try again.";
      }

      showFormStatus(
        message,
        true
      );
    } finally {
      submitButton.disabled =
        false;

      submitButton.textContent =
        "Submit Prayer Request";
    }
  }
);


if (loadMoreButton) {
  loadMoreButton.addEventListener(
    "click",
    loadOlderRequests
  );
}



signOutButton.addEventListener(
  "click",
  async function () {
    signOutButton.disabled =
      true;

    try {
      await signOut(auth);

      window.location.href =
        "index.html";
    } catch (error) {
      console.error(error);

      showToast(
        "Could not sign out. Please try again.",
        true
      );

      signOutButton.disabled =
        false;
    }
  }
);


onAuthStateChanged(
  auth,
  async function (user) {
    disableStaffInbox();

    if (!user) {
      return;
    }

    try {
      const profile =
        await loadStaffProfile(user);

      if (!profile) {
        return;
      }

      enableStaffInbox(
        user,
        profile
      );
    } catch (error) {
      console.error(error);
    }
  }
);
