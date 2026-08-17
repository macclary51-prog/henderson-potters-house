import {
  auth,
  db
} from "./firebase-config.js";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";


const loginForm =
  document.getElementById("staffLoginForm");

const loginButton =
  document.getElementById("staffLoginButton");

const resetButton =
  document.getElementById("resetPasswordButton");

const messageBox =
  document.getElementById("authMessage");


function showMessage(message, isError = false) {
  if (!messageBox) {
    return;
  }

  messageBox.textContent = message;
  messageBox.classList.toggle("error", isError);
  messageBox.style.display = "block";
}


function friendlyError(error) {
  switch (error.code) {
    case "auth/invalid-email":
      return "Enter a valid email address.";

    case "auth/invalid-credential":
      return "The email address or password is incorrect.";

    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment and try again.";

    case "auth/network-request-failed":
      return "Check your internet connection and try again.";

    case "auth/unauthorized-domain":
      return "Staff sign-in is not available from this website address. Please contact the site administrator.";

    default:
      console.error(error);
      return "Something went wrong. Please try again.";
  }
}


async function getApprovedStaff(user) {
  const staffSnapshot = await getDoc(
    doc(db, "staff", user.uid)
  );

  if (!staffSnapshot.exists()) {
    return null;
  }

  const staff = staffSnapshot.data();
  const role =
    String(staff.role || "")
      .trim()
      .toLowerCase();

  if (
    staff.active !== true ||
    !["pastor", "ministry"].includes(role)
  ) {
    return null;
  }

  return {
    ...staff,
    role
  };
}


async function sendStaffToWebsite(user) {
  const staff =
    await getApprovedStaff(user);

  if (!staff) {
    return false;
  }

  /*
    Staff now edit directly on the normal public pages.
    There is no separate dashboard destination.
  */
  window.location.href =
    "announcements.html";

  return true;
}


if (loginForm) {
  loginForm.addEventListener(
    "submit",
    async function (event) {
      event.preventDefault();

      const email =
        document
          .getElementById("staffEmail")
          .value
          .trim();

      const password =
        document
          .getElementById("staffPassword")
          .value;

      loginButton.disabled = true;
      loginButton.textContent = "Signing In...";

      try {
        const result =
          await signInWithEmailAndPassword(
            auth,
            email,
            password
          );

        const approved =
          await sendStaffToWebsite(
            result.user
          );

        if (!approved) {
          await signOut(auth);

          showMessage(
            "This account is not approved for church staff access.",
            true
          );
        }
      } catch (error) {
        showMessage(
          friendlyError(error),
          true
        );
      } finally {
        loginButton.disabled = false;
        loginButton.textContent =
          "Staff Sign In";
      }
    }
  );
}


if (resetButton) {
  resetButton.addEventListener(
    "click",
    async function () {
      const email =
        document
          .getElementById("staffEmail")
          .value
          .trim();

      if (!email) {
        showMessage(
          "Enter your email address first, then select Reset Password.",
          true
        );

        return;
      }

      resetButton.disabled = true;
      resetButton.textContent =
        "Sending...";

      try {
        await sendPasswordResetEmail(
          auth,
          email
        );

        showMessage(
          "If an approved account uses that address, Firebase will send password-reset instructions."
        );
      } catch (error) {
        if (error.code === "auth/user-not-found") {
          showMessage(
            "If an approved account uses that address, Firebase will send password-reset instructions."
          );
        } else {
          showMessage(
            friendlyError(error),
            true
          );
        }
      } finally {
        resetButton.disabled = false;
        resetButton.textContent =
          "Reset Password";
      }
    }
  );
}


onAuthStateChanged(
  auth,
  async function (user) {
    if (!user) {
      return;
    }

    try {
      const approved =
        await sendStaffToWebsite(user);

      if (!approved) {
        await signOut(auth);

        showMessage(
          "This account is not approved for church staff access.",
          true
        );
      }
    } catch (error) {
      console.error(error);
    }
  }
);
