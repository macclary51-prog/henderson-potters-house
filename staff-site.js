import {
  auth,
  db
} from "./firebase-config.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";


const navLinks =
  document.getElementById("navLinks");

let staffLink = null;
let staffBar = null;


function normalizeRole(role) {
  return String(role || "")
    .trim()
    .toLowerCase();
}


function roleLabel(role) {
  return role === "pastor"
    ? "Pastor"
    : "Ministry";
}


function closeMobileNavigation() {
  if (!navLinks) {
    return;
  }

  navLinks.classList.remove("open");

  const menuButton =
    document.getElementById("menuButton");

  if (menuButton) {
    menuButton.setAttribute(
      "aria-expanded",
      "false"
    );
  }
}


function ensureStaffLink() {
  if (!navLinks) {
    return null;
  }

  staffLink =
    navLinks.querySelector(
      'a[data-staff-navigation], a[href="staff-login.html"], a[href="staff-dashboard.html"]'
    );

  if (!staffLink) {
    staffLink =
      document.createElement("a");

    navLinks.appendChild(
      staffLink
    );
  }

  staffLink.dataset.staffNavigation =
    "true";

  staffLink.addEventListener(
    "click",
    closeMobileNavigation
  );

  return staffLink;
}


function addStyles() {
  if (
    document.getElementById(
      "persistentStaffModeStyles"
    )
  ) {
    return;
  }

  const style =
    document.createElement("style");

  style.id =
    "persistentStaffModeStyles";

  style.textContent = `
    .persistent-staff-bar {
      position: relative;
      z-index: 900;
      color: #ffffff;
      background:
        radial-gradient(circle at 85% 20%, rgba(224, 58, 47, 0.22), transparent 20rem),
        linear-gradient(135deg, #07182c, #102b4e);
      border-bottom: 1px solid rgba(255, 255, 255, 0.15);
      box-shadow: 0 10px 26px rgba(7, 24, 44, 0.16);
    }

    .persistent-staff-bar-inner {
      width: min(1120px, calc(100% - 32px));
      min-height: 68px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      padding: 11px 0;
    }

    .persistent-staff-identity {
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 11px;
    }

    .persistent-staff-avatar {
      width: 42px;
      height: 42px;
      flex: 0 0 auto;
      display: grid;
      place-items: center;
      color: #ffffff;
      background: linear-gradient(135deg, #4169e1, #27408b);
      border-radius: 50%;
      font-size: 0.75rem;
      font-weight: 900;
      letter-spacing: 0.04em;
    }

    .persistent-staff-copy {
      min-width: 0;
      display: grid;
      line-height: 1.2;
    }

    .persistent-staff-copy small {
      color: #bfcddd;
      font-size: 0.67rem;
    }

    .persistent-staff-copy strong,
    .persistent-staff-copy span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .persistent-staff-copy strong {
      font-size: 0.88rem;
    }

    .persistent-staff-copy span {
      color: #ffd4be;
      font-size: 0.72rem;
      font-weight: 800;
    }

    .persistent-staff-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }

    .persistent-staff-actions a,
    .persistent-staff-actions button {
      min-height: 38px;
      padding: 0 12px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.24);
      border-radius: 10px;
      cursor: pointer;
      font: inherit;
      font-size: 0.73rem;
      font-weight: 850;
      text-decoration: none;
    }

    .persistent-staff-actions a:hover,
    .persistent-staff-actions button:hover {
      background: rgba(255, 255, 255, 0.18);
    }

    .persistent-staff-actions .primary {
      background: linear-gradient(135deg, #4169e1, #27408b);
      border-color: transparent;
    }

    .nav-links a[data-staff-navigation="true"] {
      color: #c9342f;
    }

    @media (max-width: 820px) {
      .persistent-staff-bar-inner {
        align-items: flex-start;
        flex-direction: column;
      }

      .persistent-staff-actions {
        width: 100%;
        justify-content: stretch;
      }

      .persistent-staff-actions a,
      .persistent-staff-actions button {
        flex: 1 1 135px;
      }
    }

    @media (max-width: 620px) {
      .persistent-staff-bar-inner {
        width: min(100% - 22px, 1120px);
      }

      .persistent-staff-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
      }

      .persistent-staff-actions a,
      .persistent-staff-actions button {
        width: 100%;
      }
    }
  `;

  document.head.appendChild(
    style
  );
}


function initials(name) {
  const parts =
    String(name || "")
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


function removeStaffBar() {
  if (staffBar) {
    staffBar.remove();
    staffBar = null;
  }

  document
    .querySelectorAll(".persistent-staff-bar")
    .forEach(function (bar) {
      bar.remove();
    });
}


function createStaffBar(user, profile) {
  /*
    These pages already show their own full staff controls.
    Avoid a duplicate staff bar.
  */
  if (
    document.getElementById("staffInlineShell") ||
    document.getElementById("givingPastorShell") ||
    document.getElementById("connectPastorShell") ||
    document.getElementById("homePastorShell") ||
    document.getElementById("prayerStaffShell")
  ) {
    removeStaffBar();
    return;
  }

  removeStaffBar();
  addStyles();

  const displayName =
    profile.name ||
    user.email ||
    "Staff Member";

  staffBar =
    document.createElement("section");

  staffBar.className =
    "persistent-staff-bar";

  const inner =
    document.createElement("div");

  inner.className =
    "persistent-staff-bar-inner";

  const identity =
    document.createElement("div");

  identity.className =
    "persistent-staff-identity";

  const avatar =
    document.createElement("span");

  avatar.className =
    "persistent-staff-avatar";

  avatar.textContent =
    initials(displayName);

  const copy =
    document.createElement("div");

  copy.className =
    "persistent-staff-copy";

  const small =
    document.createElement("small");

  small.textContent =
    "Staff mode is active";

  const strong =
    document.createElement("strong");

  strong.textContent =
    displayName;

  const role =
    document.createElement("span");

  role.textContent =
    roleLabel(profile.role);

  copy.append(
    small,
    strong,
    role
  );

  identity.append(
    avatar,
    copy
  );

  const actions =
    document.createElement("div");

  actions.className =
    "persistent-staff-actions";

  const links = [
    {
      href: "index.html",
      text: "Edit Home",
      primary: true
    },
    {
      href: "announcements.html",
      text: "Edit Announcements"
    },
    {
      href: "events.html",
      text: "Edit Events"
    },
    {
      href: "services.html",
      text: "Edit Services"
    },
    {
      href: "sermons.html",
      text: "Edit Sermons"
    },
    {
      href: "ministries.html",
      text: "Edit Ministries"
    },
    {
      href: "prayer.html",
      text: "Prayer Requests"
    }
  ];

  if (profile.role === "pastor") {
    links.push({
      href: "giving.html",
      text: "Edit Giving"
    });

    links.push({
      href: "connect.html",
      text: "Edit Links"
    });
  }

  links.forEach(function (item) {
    const link =
      document.createElement("a");

    link.href =
      item.href;

    link.textContent =
      item.text;

    if (item.primary) {
      link.classList.add("primary");
    }

    actions.appendChild(link);
  });

  const signOutButton =
    document.createElement("button");

  signOutButton.type =
    "button";

  signOutButton.textContent =
    "Sign Out";

  signOutButton.addEventListener(
    "click",
    async function () {
      signOutButton.disabled = true;

      try {
        await signOut(auth);
        window.location.href =
          "index.html";
      } catch (error) {
        console.error(error);
        signOutButton.disabled = false;

        window.alert(
          "Could not sign out. Please try again."
        );
      }
    }
  );

  actions.appendChild(signOutButton);

  inner.append(
    identity,
    actions
  );

  staffBar.appendChild(inner);

  const header =
    document.querySelector(".site-header");

  if (header) {
    header.insertAdjacentElement(
      "afterend",
      staffBar
    );
  } else {
    document.body.prepend(staffBar);
  }
}


async function loadApprovedStaff(user) {
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


const link =
  ensureStaffLink();

if (link) {
  link.href =
    "staff-login.html";

  link.textContent =
    "Staff";
}


onAuthStateChanged(
  auth,
  async function (user) {
    if (!user) {
      removeStaffBar();

      if (staffLink) {
        staffLink.href =
          "staff-login.html";

        staffLink.textContent =
          "Staff";
      }

      return;
    }

    try {
      const profile =
        await loadApprovedStaff(user);

      if (!profile) {
        removeStaffBar();

        if (staffLink) {
          staffLink.href =
            "staff-login.html";

          staffLink.textContent =
            "Staff";
        }

        return;
      }

      const displayName =
        profile.name ||
        user.email ||
        "Staff";

      if (staffLink) {
        staffLink.href = "services.html";

        staffLink.textContent =
          `Staff: ${displayName}`;
      }

      createStaffBar(
        user,
        profile
      );
    } catch (error) {
      console.error(
        "Staff navigation check failed:",
        error
      );

      removeStaffBar();
    }
  }
);
