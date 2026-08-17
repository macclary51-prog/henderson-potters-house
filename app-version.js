const versionLabel =
  document.getElementById("appVersion");

const versionCodeLabel =
  document.getElementById("appVersionCode");

const minimumAndroidLabel =
  document.getElementById("appMinimumAndroid");

const releaseDateLabel =
  document.getElementById("appReleaseDate");

const checksumLabel =
  document.getElementById("appChecksum");


function formatReleaseDate(value) {
  const match =
    String(value || "")
      .match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC"
    }
  ).format(
    new Date(
      Date.UTC(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3])
      )
    )
  );
}


fetch("app-version.json", {
  headers: {
    Accept: "application/json"
  }
})
  .then(function (response) {
    if (!response.ok) {
      throw new Error(
        `App version request failed with ${response.status}`
      );
    }

    return response.json();
  })
  .then(function (data) {
    if (versionLabel && data.version) {
      versionLabel.textContent =
        `Version ${data.version}`;
    }

    if (
      versionCodeLabel &&
      Number.isInteger(data.versionCode)
    ) {
      versionCodeLabel.textContent =
        `Build ${data.versionCode}`;
    }

    if (
      minimumAndroidLabel &&
      data.minimumAndroidVersion
    ) {
      minimumAndroidLabel.textContent =
        `Android ${data.minimumAndroidVersion} or newer`;
    }

    const formattedDate =
      formatReleaseDate(data.releaseDate);

    if (releaseDateLabel && formattedDate) {
      releaseDateLabel.textContent =
        `Updated ${formattedDate}`;
    }

    if (checksumLabel && data.sha256) {
      checksumLabel.textContent =
        data.sha256;
    }
  })
  .catch(function (error) {
    console.error(
      "App version information could not be loaded:",
      error
    );
  });
