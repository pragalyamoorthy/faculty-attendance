document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#login-form");
  const message = document.querySelector("#login-message");
  const hint = document.querySelector("#demo-hint");

  window.FacultyApp.json("/api/config").then(({ demoMode }) => {
    hint.hidden = !demoMode;
  }).catch((error) => {
    message.textContent = error.message;
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.textContent = "";
    const formData = new FormData(form);
    try {
      await window.FacultyApp.json("/api/login", {
        method: "POST",
        body: JSON.stringify({
          username: formData.get("username"),
          password: formData.get("password")
        })
      });
      location.assign("/admin-dashboard.html");
    } catch (error) {
      message.textContent = error.message;
    }
  });
});
