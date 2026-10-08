document.addEventListener("faculty-app-ready", async () => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [faculty, attendance] = await Promise.all([
      FacultyApp.json("/api/faculty"),
      FacultyApp.json(`/api/attendance?date=${today}`)
    ]);
    document.querySelector("#faculty-count").textContent = faculty.length;
    document.querySelector("#present-count").textContent =
      attendance.filter((row) => row.status === "present").length;
    document.querySelector("#today-count").textContent =
      attendance.filter((row) => row.status).length;
    document.querySelector("#dashboard-date").textContent =
      new Date(`${today}T00:00:00`).toLocaleDateString();
  } catch (error) {
    document.querySelector("#dashboard-message").textContent = error.message;
  }
});
