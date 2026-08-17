import {
  auth,
  db
} from "./firebase-config.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";


const GIVING_DOCUMENT =
  doc(db, "siteSettings", "giving");

const DEFAULT_ZELLE =
  "(702) 600-7632";

const DEFAULT_CASH_APP =
  "$potterhousehenderson";

const DEFAULT_CASH_APP_LINK =
  "https://cash.app/$potterhousehenderson";

const publicTitle =
  document.getElementById("givingPublicTitle");

const publicMessage =
  document.getElementById("givingPublicMessage");

const methodGrid =
  document.getElementById("givingMethodGrid");

const otherCard =
  document.getElementById("givingOtherCard");

const otherInstructions =
  document.getElementById("givingOtherInstructions");

const pastorShell =
  document.getElementById("givingPastorShell");

const pastorName =
  document.getElementById("givingPastorName");

const editButton =
  document.getElementById("givingEditButton");

const editor =
  document.getElementById("givingEditor");

const editorForm =
  document.getElementById("givingEditor");

const closeButton =
  document.getElementById("givingCloseButton");

const cancelButton =
  document.getElementById("givingCancelButton");

const saveButton =
  document.getElementById("givingSaveButton");

const statusBox =
  document.getElementById("givingStatus");

const toast =
  document.getElementById("givingToast");

let currentUser = null;
let currentGiving = {};
let toastTimer = null;

methodGrid.setAttribute(
  "aria-live",
  "polite"
);


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


function safeText(value) {
  return String(value || "").trim();
}


function safeLink(value) {
  const text = safeText(value);

  if (!text) {
    return "";
  }

  try {
    const url = new URL(text);

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


function safePhoneLink(value) {
  const phone =
    safeText(value)
      .replace(/^tel:/i, "")
      .replace(/[^\d+]/g, "");

  return /^\+?\d{3,}$/.test(phone)
    ? `tel:${phone}`
    : "";
}


async function copyValue(value, label) {
  try {
    await navigator.clipboard.writeText(value);
    showToast(`${label} copied.`);
  } catch (error) {
    console.error(error);
    window.prompt(`Copy the ${label.toLowerCase()}:`, value);
  }
}


function createMethodCard({
  type,
  icon,
  title,
  description,
  value,
  copyLabel,
  link,
  linkLabel
}) {
  const card =
    document.createElement("article");

  card.className =
    `giving-method-card ${type || ""}`.trim();

  const iconBox =
    document.createElement("span");

  iconBox.className =
    "giving-method-icon";

  iconBox.setAttribute(
    "aria-hidden",
    "true"
  );

  iconBox.textContent =
    icon;

  const heading =
    document.createElement("h3");

  heading.textContent =
    title;

  const descriptionText =
    document.createElement("p");

  descriptionText.textContent =
    description;

  const valueText =
    document.createElement("strong");

  valueText.className =
    "giving-method-value";

  valueText.textContent =
    value;

  const actions =
    document.createElement("div");

  actions.className =
    "giving-card-actions";

  const copyButton =
    document.createElement("button");

  copyButton.type =
    "button";

  copyButton.textContent =
    "Copy";

  copyButton.setAttribute(
    "aria-label",
    `Copy ${copyLabel || title}`
  );

  copyButton.addEventListener(
    "click",
    function () {
      copyValue(
        value,
        copyLabel || title
      );
    }
  );

  actions.appendChild(
    copyButton
  );

  if (link) {
    const actionLink =
      document.createElement("a");

    actionLink.href =
      link;

    if (/^https?:\/\//i.test(link)) {
      actionLink.target =
        "_blank";

      actionLink.rel =
        "noopener noreferrer";
    }

    actionLink.className =
      "primary";

    actionLink.textContent =
      linkLabel || "Open";

    actions.appendChild(
      actionLink
    );
  }

  card.append(
    iconBox,
    heading,
    descriptionText,
    valueText,
    actions
  );

  return card;
}


function renderGiving(data) {
  currentGiving = data || {};

  publicTitle.textContent =
    safeText(currentGiving.title) ||
    "Giving";

  const givingMessage =
    safeText(currentGiving.message);

  publicMessage.textContent =
    givingMessage;

  publicMessage.hidden =
    !givingMessage;

  methodGrid.replaceChildren();

  const phone =
    safeText(currentGiving.phone);

  const zelle =
    safeText(currentGiving.zelle) ||
    DEFAULT_ZELLE;

  const cashApp =
    safeText(currentGiving.cashApp) ||
    DEFAULT_CASH_APP;

  const cashAppLink =
    safeLink(currentGiving.cashAppLink) ||
    DEFAULT_CASH_APP_LINK;

  let methodCount = 0;

  if (phone) {
    methodGrid.appendChild(
      createMethodCard({
        type: "phone",
        icon: "☎",
        title: "Church Phone",
        description:
          "Contact the church using this verified phone number for giving information.",
        value: phone,
        copyLabel: "Phone number",
        link: safePhoneLink(phone),
        linkLabel: "Call"
      })
    );

    methodCount += 1;
  }

  if (zelle) {
    methodGrid.appendChild(
      createMethodCard({
        type: "zelle",
        icon: "Z",
        title: "Zelle",
        description:
          "Use the verified church phone number or email shown below.",
        value: zelle,
        copyLabel: "Zelle information"
      })
    );

    methodCount += 1;
  }

  if (cashApp) {
    methodGrid.appendChild(
      createMethodCard({
        type: "cash-app",
        icon: "$",
        title: "Cash App",
        description:
          "Use the verified church Cash App name shown below.",
        value: cashApp,
        copyLabel: "Cash App name",
        link: cashAppLink,
        linkLabel: "Open Cash App"
      })
    );

    methodCount += 1;
  }

  if (methodCount === 0) {
    const empty =
      document.createElement("div");

    empty.className =
      "giving-empty-state";

    empty.textContent =
      "Giving information has not been published yet.";

    methodGrid.appendChild(
      empty
    );
  }

  const other =
    safeText(
      currentGiving.otherInstructions
    );

  if (other) {
    otherInstructions.textContent =
      other;

    otherCard.hidden =
      false;
  } else {
    otherInstructions.textContent =
      "";

    otherCard.hidden =
      true;
  }
}


function fillEditor() {
  editorForm.elements.title.value =
    safeText(currentGiving.title);

  editorForm.elements.message.value =
    safeText(currentGiving.message);

  editorForm.elements.phone.value =
    safeText(currentGiving.phone);

  editorForm.elements.zelle.value =
    safeText(currentGiving.zelle) ||
    DEFAULT_ZELLE;

  editorForm.elements.cashApp.value =
    safeText(currentGiving.cashApp) ||
    DEFAULT_CASH_APP;

  editorForm.elements.cashAppLink.value =
    safeText(currentGiving.cashAppLink) ||
    DEFAULT_CASH_APP_LINK;

  editorForm.elements.otherInstructions.value =
    safeText(
      currentGiving.otherInstructions
    );
}


function openEditor() {
  fillEditor();
  hideStatus();
  editor.hidden = false;

  editor.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}


function closeEditor() {
  editor.hidden = true;
  hideStatus();
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


editButton.addEventListener(
  "click",
  openEditor
);

closeButton.addEventListener(
  "click",
  closeEditor
);

cancelButton.addEventListener(
  "click",
  closeEditor
);


editorForm.addEventListener(
  "submit",
  async function (event) {
    event.preventDefault();

    if (!currentUser) {
      showStatus(
        "Only the approved pastor can update giving information.",
        true
      );

      return;
    }

    const formData =
      new FormData(editorForm);

    const cashAppLink =
      safeText(
        formData.get("cashAppLink")
      );

    if (
      cashAppLink &&
      !safeLink(cashAppLink)
    ) {
      showStatus(
        "Enter a complete http:// or https:// link for Cash App.",
        true
      );

      return;
    }

    const data = {
      title:
        safeText(formData.get("title")) ||
        "Giving",

      message:
        safeText(formData.get("message")),

      phone:
        safeText(formData.get("phone")),

      zelle:
        safeText(formData.get("zelle")),

      cashApp:
        safeText(formData.get("cashApp")),

      cashAppLink:
        cashAppLink,

      otherInstructions:
        safeText(
          formData.get("otherInstructions")
        ),

      updatedAt:
        serverTimestamp(),

      updatedBy:
        currentUser.uid
    };

    saveButton.disabled =
      true;

    saveButton.textContent =
      "Saving...";

    hideStatus();

    try {
      await setDoc(
        GIVING_DOCUMENT,
        data,
        {
          merge: true
        }
      );

      showToast(
        "Giving information updated."
      );

      closeEditor();
    } catch (error) {
      console.error(error);

      showStatus(
        "The giving information could not be saved. Please refresh and try again.",
        true
      );

      showToast(
        "Giving information could not be saved.",
        true
      );
    } finally {
      saveButton.disabled =
        false;

      saveButton.textContent =
        "Save Giving Information";
    }
  }
);


onSnapshot(
  GIVING_DOCUMENT,
  function (snapshot) {
    if (snapshot.exists()) {
      renderGiving(
        snapshot.data()
      );
    } else {
      renderGiving({});
    }
  },
  function (error) {
    console.error(error);

    const message =
      document.createElement("div");

    message.className =
      "giving-empty-state";

    message.textContent =
      "Giving information could not be loaded. Please refresh and try again.";

    methodGrid.replaceChildren(message);
  }
);


onAuthStateChanged(
  auth,
  async function (user) {
    currentUser = null;
    pastorShell.hidden = true;
    pastorName.textContent = "";
    closeEditor();

    if (!user) {
      return;
    }

    try {
      const profile =
        await loadPastorProfile(user);

      if (auth.currentUser?.uid !== user.uid) {
        return;
      }

      if (!profile) {
        return;
      }

      currentUser = user;

      pastorName.textContent =
        profile.name ||
        user.email ||
        "Pastor";

      pastorShell.hidden =
        false;
    } catch (error) {
      console.error(error);
    }
  }
);
