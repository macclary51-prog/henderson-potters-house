const menuButton =
  document.getElementById("menuButton");

const navLinks =
  document.getElementById("navLinks");

const navWrap =
  document.querySelector(".nav-wrap");


/* =========================================================
   ENSURE ALL WEBSITE LINKS EXIST
   ========================================================= */

function findStaffLink() {
  if (!navLinks) {
    return null;
  }

  return navLinks.querySelector(
    'a[data-staff-navigation="true"], a.staff-link, a[href="staff-login.html"], a[href="staff-dashboard.html"]'
  );
}


function insertNavigationLink({
  href,
  label,
  beforeSelectors = []
}) {
  if (!navLinks) {
    return null;
  }

  let link =
    navLinks.querySelector(
      `a[href="${href}"]`
    );

  if (link) {
    return link;
  }

  link =
    document.createElement("a");

  link.href =
    href;

  link.textContent =
    label;

  let beforeElement = null;

  for (const selector of beforeSelectors) {
    beforeElement =
      navLinks.querySelector(selector);

    if (beforeElement) {
      break;
    }
  }

  navLinks.insertBefore(
    link,
    beforeElement || null
  );

  return link;
}


function removeContactNavigationLinks() {
  if (!navLinks) {
    return;
  }

  navLinks
    .querySelectorAll(
      'a[href="contact.html"], a[href="./contact.html"], a[href$="/contact.html"]'
    )
    .forEach(function (link) {
      link.remove();
    });
}


function ensureAllNavigationLinks() {
  if (!navLinks) {
    return;
  }

  /*
    Connect already contains the church location, phone, and social links.
    Remove the separate Contact link from every page before building the menu.
  */
  removeContactNavigationLinks();

  insertNavigationLink({
    href: "services.html",
    label: "Services",
    beforeSelectors: [
      'a[href="ministries.html"]',
      'a[href="sermons.html"]'
    ]
  });

  insertNavigationLink({
    href: "giving.html",
    label: "Giving",
    beforeSelectors: [
      'a[href="connect.html"]',
      'a[href="prayer.html"]'
    ]
  });

  insertNavigationLink({
    href: "connect.html",
    label: "Connect",
    beforeSelectors: [
      'a[href="prayer.html"]'
    ]
  });

  let staffLink =
    findStaffLink();

  if (!staffLink) {
    staffLink =
      document.createElement("a");

    staffLink.href =
      "staff-login.html";

    staffLink.textContent =
      "Staff";

    staffLink.className =
      "staff-link";

    staffLink.dataset.staffNavigation =
      "true";

    navLinks.appendChild(
      staffLink
    );
  } else {
    staffLink.dataset.staffNavigation =
      "true";
  }

  const currentFile =
    window.location.pathname
      .split("/")
      .pop() || "index.html";

  navLinks
    .querySelectorAll("a")
    .forEach(function (link) {
      link.classList.toggle(
        "active",
        link.getAttribute("href") ===
          currentFile
      );
    });
}


/* =========================================================
   DIRECT STAFF BUTTON
   ========================================================= */

function ensureStaffShortcut() {
  if (
    !navWrap ||
    !menuButton
  ) {
    return null;
  }

  let shortcut =
    document.getElementById(
      "mobileStaffShortcut"
    );

  if (!shortcut) {
    shortcut =
      document.createElement("a");

    shortcut.id =
      "mobileStaffShortcut";

    shortcut.className =
      "mobile-staff-shortcut";

    shortcut.href =
      "staff-login.html";

    shortcut.textContent =
      "Staff";

    shortcut.setAttribute(
      "aria-label",
      "Open staff access"
    );

    navWrap.insertBefore(
      shortcut,
      menuButton
    );
  }

  return shortcut;
}


function syncStaffShortcut() {
  const shortcut =
    ensureStaffShortcut();

  if (!shortcut) {
    return;
  }

  const staffLink =
    findStaffLink();

  shortcut.href =
    staffLink?.getAttribute("href") ||
    "staff-login.html";

  shortcut.textContent =
    "Staff";
}


/* =========================================================
   FULL MENU OVERLAY
   This is independent from the old dropdown, so no parent element,
   page card, or header can cut it off.
   ========================================================= */

let menuOverlay = null;


function addOverlayStyles() {
  if (
    document.getElementById(
      "fullWebsiteMenuOverlayStyles"
    )
  ) {
    return;
  }

  const style =
    document.createElement("style");

  style.id =
    "fullWebsiteMenuOverlayStyles";

  style.textContent = `
    #fullWebsiteMenuOverlay[hidden] {
      display: none !important;
    }

    #fullWebsiteMenuOverlay {
      position: fixed !important;
      z-index: 2147483646 !important;
      inset: 0 !important;
      display: grid !important;
      place-items: center !important;
      box-sizing: border-box !important;
      padding:
        max(12px, env(safe-area-inset-top))
        max(12px, env(safe-area-inset-right))
        max(12px, env(safe-area-inset-bottom))
        max(12px, env(safe-area-inset-left)) !important;
      overflow: hidden !important;
      background: rgba(7, 24, 44, 0.72) !important;
      backdrop-filter: blur(8px) !important;
    }

    .full-website-menu-panel {
      display: flex !important;
      width: min(900px, 100%) !important;
      max-height: calc(100vh - 24px) !important;
      max-height: calc(100dvh - 24px) !important;
      flex-direction: column !important;
      overflow: hidden !important;
      color: #172033 !important;
      background: #ffffff !important;
      border: 1px solid #dce2e9 !important;
      border-radius: 24px !important;
      box-shadow: 0 30px 90px rgba(0, 0, 0, 0.35) !important;
    }

    .full-website-menu-heading {
      display: flex !important;
      flex: 0 0 auto !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 18px !important;
      padding: 20px 22px !important;
      color: #ffffff !important;
      background:
        radial-gradient(
          circle at 88% 10%,
          rgba(224, 58, 47, 0.36),
          transparent 18rem
        ),
        linear-gradient(135deg, #07182c, #102b4e) !important;
    }

    .full-website-menu-heading-copy {
      display: grid !important;
      min-width: 0 !important;
      gap: 2px !important;
    }

    .full-website-menu-heading small {
      color: #ffd0bb !important;
      font-size: 0.7rem !important;
      font-weight: 900 !important;
      letter-spacing: 0.09em !important;
      text-transform: uppercase !important;
    }

    .full-website-menu-heading strong {
      font-size: 1.35rem !important;
      line-height: 1.15 !important;
    }

    .full-website-menu-close {
      display: grid !important;
      width: 46px !important;
      height: 46px !important;
      flex: 0 0 46px !important;
      place-items: center !important;
      padding: 0 !important;
      color: #ffffff !important;
      background: rgba(255, 255, 255, 0.12) !important;
      border: 1px solid rgba(255, 255, 255, 0.28) !important;
      border-radius: 13px !important;
      cursor: pointer !important;
      font-size: 1.55rem !important;
      line-height: 1 !important;
    }

    .full-website-menu-scroll {
      display: block !important;
      flex: 1 1 auto !important;
      min-height: 0 !important;
      padding: 18px !important;
      overflow-x: hidden !important;
      overflow-y: auto !important;
      overscroll-behavior: contain !important;
      -webkit-overflow-scrolling: touch !important;
    }

    .full-website-menu-grid {
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 10px !important;
    }

    .full-website-menu-grid a {
      display: flex !important;
      min-width: 0 !important;
      min-height: 62px !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 12px !important;
      box-sizing: border-box !important;
      padding: 14px 16px !important;
      overflow: hidden !important;
      color: #102b4e !important;
      background: #eef2f7 !important;
      border: 1px solid #dce2e9 !important;
      border-radius: 14px !important;
      font-size: 0.94rem !important;
      font-weight: 900 !important;
      text-decoration: none !important;
    }

    .full-website-menu-grid a::after {
      content: "→" !important;
      flex: 0 0 auto !important;
      color: #e03a2f !important;
      font-size: 1.1rem !important;
    }

    .full-website-menu-grid a:hover,
    .full-website-menu-grid a:focus,
    .full-website-menu-grid a.active {
      color: #ffffff !important;
      background: linear-gradient(135deg, #e03a2f, #f26a32) !important;
      border-color: transparent !important;
    }

    .full-website-menu-grid a:hover::after,
    .full-website-menu-grid a:focus::after,
    .full-website-menu-grid a.active::after {
      color: #ffffff !important;
    }

    .full-website-menu-grid a.full-menu-staff-link {
      grid-column: 1 / -1 !important;
      color: #ffffff !important;
      background: linear-gradient(135deg, #102b4e, #07182c) !important;
      border: 2px solid #f26a32 !important;
    }

    .full-website-menu-grid a.full-menu-staff-link::after {
      color: #ffd0bb !important;
    }

    body.full-website-menu-open {
      overflow: hidden !important;
    }

    @media (max-width: 620px) {
      #fullWebsiteMenuOverlay {
        padding: 8px !important;
      }

      .full-website-menu-panel {
        max-height: calc(100vh - 16px) !important;
        max-height: calc(100dvh - 16px) !important;
        border-radius: 20px !important;
      }

      .full-website-menu-heading {
        padding: 17px 16px !important;
      }

      .full-website-menu-heading strong {
        font-size: 1.15rem !important;
      }

      .full-website-menu-scroll {
        padding: 12px !important;
      }

      .full-website-menu-grid {
        grid-template-columns: 1fr !important;
        gap: 8px !important;
      }

      .full-website-menu-grid a {
        min-height: 54px !important;
        padding: 12px 14px !important;
      }

      .full-website-menu-grid a.full-menu-staff-link {
        grid-column: auto !important;
        order: -1 !important;
      }
    }
  `;

  document.head.appendChild(
    style
  );
}


function createMenuOverlay() {
  if (menuOverlay) {
    return menuOverlay;
  }

  addOverlayStyles();

  menuOverlay =
    document.createElement("div");

  menuOverlay.id =
    "fullWebsiteMenuOverlay";

  menuOverlay.hidden =
    true;

  menuOverlay.setAttribute(
    "role",
    "dialog"
  );

  menuOverlay.setAttribute(
    "aria-modal",
    "true"
  );

  menuOverlay.setAttribute(
    "aria-label",
    "Website navigation"
  );

  const panel =
    document.createElement("section");

  panel.className =
    "full-website-menu-panel";

  const heading =
    document.createElement("div");

  heading.className =
    "full-website-menu-heading";

  const copy =
    document.createElement("div");

  copy.className =
    "full-website-menu-heading-copy";

  const small =
    document.createElement("small");

  small.textContent =
    "The Henderson Potter's House";

  const title =
    document.createElement("strong");

  title.textContent =
    "Website Menu";

  copy.append(
    small,
    title
  );

  const closeButton =
    document.createElement("button");

  closeButton.type =
    "button";

  closeButton.className =
    "full-website-menu-close";

  closeButton.setAttribute(
    "aria-label",
    "Close menu"
  );

  closeButton.textContent =
    "×";

  heading.append(
    copy,
    closeButton
  );

  const scrollArea =
    document.createElement("div");

  scrollArea.className =
    "full-website-menu-scroll";

  const grid =
    document.createElement("nav");

  grid.className =
    "full-website-menu-grid";

  scrollArea.appendChild(
    grid
  );

  panel.append(
    heading,
    scrollArea
  );

  menuOverlay.appendChild(
    panel
  );

  document.body.appendChild(
    menuOverlay
  );

  closeButton.addEventListener(
    "click",
    closeFullMenu
  );

  menuOverlay.addEventListener(
    "click",
    function (event) {
      if (event.target === menuOverlay) {
        closeFullMenu();
      }
    }
  );

  grid.addEventListener(
    "click",
    function (event) {
      if (event.target.closest("a")) {
        closeFullMenu();
      }
    }
  );

  return menuOverlay;
}


function rebuildOverlayLinks() {
  const overlay =
    createMenuOverlay();

  const grid =
    overlay.querySelector(
      ".full-website-menu-grid"
    );

  grid.replaceChildren();

  ensureAllNavigationLinks();

  navLinks
    ?.querySelectorAll("a")
    .forEach(function (sourceLink) {
      const href =
        sourceLink.getAttribute("href");

      if (!href) {
        return;
      }

      const link =
        document.createElement("a");

      link.href =
        href;

      link.textContent =
        sourceLink.textContent.trim();

      if (
        sourceLink.classList.contains("active")
      ) {
        link.classList.add("active");
      }

      if (
        sourceLink.matches(
          '[data-staff-navigation="true"], .staff-link, [href="staff-login.html"], [href="staff-dashboard.html"]'
        )
      ) {
        link.classList.add(
          "full-menu-staff-link"
        );
      }

      grid.appendChild(
        link
      );
    });
}


function openFullMenu() {
  const overlay =
    createMenuOverlay();

  /*
    Remove the old dropdown state in case previous CSS is still cached.
  */
  navLinks?.classList.remove("open");

  rebuildOverlayLinks();

  overlay.hidden =
    false;

  document.body.classList.add(
    "full-website-menu-open"
  );

  menuButton?.setAttribute(
    "aria-expanded",
    "true"
  );

  const closeButton =
    overlay.querySelector(
      ".full-website-menu-close"
    );

  window.setTimeout(
    function () {
      closeButton?.focus();
    },
    20
  );
}


function closeFullMenu() {
  if (!menuOverlay) {
    return;
  }

  menuOverlay.hidden =
    true;

  document.body.classList.remove(
    "full-website-menu-open"
  );

  menuButton?.setAttribute(
    "aria-expanded",
    "false"
  );

  menuButton?.focus();
}


/* =========================================================
   START NAVIGATION
   ========================================================= */

ensureAllNavigationLinks();
ensureStaffShortcut();
syncStaffShortcut();
createMenuOverlay();


if (
  menuButton &&
  navLinks
) {
  /*
    Never open the old dropdown. Always open the independent overlay.
  */
  menuButton.addEventListener(
    "click",
    function (event) {
      event.preventDefault();
      event.stopPropagation();

      if (
        menuOverlay &&
        !menuOverlay.hidden
      ) {
        closeFullMenu();
      } else {
        openFullMenu();
      }
    }
  );
}


document.addEventListener(
  "keydown",
  function (event) {
    if (
      event.key === "Escape" &&
      menuOverlay &&
      !menuOverlay.hidden
    ) {
      closeFullMenu();
    }
  }
);


window.addEventListener(
  "pageshow",
  function () {
    navLinks?.classList.remove("open");
    closeFullMenu();
  }
);


/*
  Firebase may update the Staff link after this file loads.
  Keep the direct button and full menu synchronized.
*/
if (navLinks) {
  const observer =
    new MutationObserver(
      function () {
        removeContactNavigationLinks();
        syncStaffShortcut();

        if (
          menuOverlay &&
          !menuOverlay.hidden
        ) {
          rebuildOverlayLinks();
        }
      }
    );

  observer.observe(
    navLinks,
    {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
      attributeFilter: ["href", "class"]
    }
  );
}


/* =========================================================
   EXISTING SHARED WEBSITE FEATURES
   ========================================================= */

document
  .querySelectorAll("[data-demo-form]")
  .forEach(function (form) {
    form.addEventListener(
      "submit",
      function (event) {
        event.preventDefault();

        const status =
          form.querySelector(
            ".status-message"
          );

        if (status) {
          status.style.display =
            "block";
        }

        form.reset();
      }
    );
  });


const year =
  document.getElementById("year");

if (year) {
  year.textContent =
    new Date().getFullYear();
}


/* Universal staff mode */
const staffSiteModule =
  document.createElement("script");

staffSiteModule.type =
  "module";

staffSiteModule.src =
  "staff-site.js?v=9";

document.body.appendChild(
  staffSiteModule
);


/* Footer location and social links */
const publicLinksModule =
  document.createElement("script");

publicLinksModule.type =
  "module";

publicLinksModule.src =
  "site-links.js?v=4";

document.body.appendChild(
  publicLinksModule
);
