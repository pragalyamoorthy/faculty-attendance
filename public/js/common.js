(() => {
  const banner = document.querySelector("[data-demo-banner]");
  const headerName = document.querySelector("[data-user-name]");
  const pageName = location.pathname.split("/").pop();
  const isLoginPage = pageName === "login.html" || pageName === "";

  async function api(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      credentials: "same-origin",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers
      }
    });
    if (!response.ok) {
      let message = `Request failed (${response.status}).`;
      try {
        const body = await response.json();
        if (body.error) message = body.error;
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
      }
      if (response.status === 401 && !isLoginPage) {
        location.replace("/login.html");
      }
      throw new Error(message);
    }
    return response;
  }

  async function json(url, options) {
    return (await api(url, options)).json();
  }

  async function logout() {
    await json("/api/logout", { method: "POST" });
    location.replace("/login.html");
  }

  window.FacultyApp = { api, json, logout };

  const logoutButton = document.querySelector("[data-logout]");
  if (logoutButton) {
    logoutButton.addEventListener("click", () => {
      logout().catch((error) => window.alert(error.message));
    });
  }

  json("/api/config").then(({ demoMode }) => {
    if (banner) banner.hidden = !demoMode;
  }).catch((error) => console.error("Could not load application configuration:", error));

  if (!isLoginPage) {
    json("/api/me").then((user) => {
      if (headerName) headerName.textContent = user.displayName;
      document.dispatchEvent(new CustomEvent("faculty-app-ready", { detail: user }));
    }).catch((error) => {
      if (!/401/.test(error.message)) console.error("Could not load signed-in user:", error);
    });
  }
})();
