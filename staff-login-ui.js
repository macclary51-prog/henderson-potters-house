/*
  Keep the staff login usable after mobile menus, cached navigation,
  orientation changes, and on-screen keyboard resizing.
*/
function unlockLoginPageScroll() {
  document.documentElement.style.overflowY =
    "auto";

  document.documentElement.style.height =
    "auto";

  document.body.style.position =
    "static";

  document.body.style.height =
    "auto";

  document.body.style.overflowY =
    "auto";

  document.body.style.touchAction =
    "pan-y";

  document.body.classList.remove(
    "menu-open",
    "modal-open",
    "no-scroll"
  );
}


unlockLoginPageScroll();

window.addEventListener(
  "pageshow",
  unlockLoginPageScroll
);

window.addEventListener(
  "orientationchange",
  function () {
    window.setTimeout(
      unlockLoginPageScroll,
      200
    );
  }
);


const loginInputs =
  document.querySelectorAll(
    "#staffLoginForm input"
  );

loginInputs.forEach(function (input) {
  input.addEventListener(
    "focus",
    function () {
      window.setTimeout(
        function () {
          input.scrollIntoView({
            behavior: "smooth",
            block: "center"
          });
        },
        350
      );
    }
  );
});


const showPasswordButton =
  document.getElementById(
    "showPasswordButton"
  );

const passwordInput =
  document.getElementById(
    "staffPassword"
  );

if (
  showPasswordButton &&
  passwordInput
) {
  showPasswordButton.addEventListener(
    "click",
    function () {
      const isVisible =
        passwordInput.type === "text";

      passwordInput.type =
        isVisible
          ? "password"
          : "text";

      showPasswordButton.textContent =
        isVisible
          ? "Show"
          : "Hide";

      showPasswordButton.setAttribute(
        "aria-pressed",
        String(!isVisible)
      );

      passwordInput.focus();
    }
  );
}


if (window.visualViewport) {
  window.visualViewport.addEventListener(
    "resize",
    function () {
      unlockLoginPageScroll();

      const active =
        document.activeElement;

      if (
        active &&
        active.matches(
          "#staffLoginForm input"
        )
      ) {
        window.setTimeout(
          function () {
            active.scrollIntoView({
              block: "center"
            });
          },
          100
        );
      }
    }
  );
}
