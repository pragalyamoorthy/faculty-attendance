document.addEventListener("faculty-app-ready", () => {
  const monthInput = document.querySelector("#report-month");
  const message = document.querySelector("#report-message");
  monthInput.value = new Date().toISOString().slice(0, 7);

  async function loadReport() {
    message.textContent = "";
    try {
      const report = await FacultyApp.json(`/api/reports?month=${encodeURIComponent(monthInput.value)}`);
      const body = document.querySelector("#report-list");
      body.replaceChildren();
      if (!report.rows.length) {
        const row = document.createElement("tr");
        const empty = document.createElement("td");
        empty.colSpan = 5;
        empty.className = "empty";
        empty.textContent = "No faculty members to report.";
        row.append(empty);
        body.append(row);
        return;
      }
      for (const person of report.rows) {
        const row = document.createElement("tr");
        for (const value of [person.name, person.department, person.present, person.absent, person.late]) {
          const cell = document.createElement("td");
          cell.textContent = value;
          row.append(cell);
        }
        body.append(row);
      }
    } catch (error) {
      message.textContent = error.message;
    }
  }

  document.querySelector("#export-csv").addEventListener("click", async () => {
    try {
      const response = await FacultyApp.api(`/api/reports/export.csv?month=${encodeURIComponent(monthInput.value)}`);
      const file = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(file);
      link.download = `attendance-${monthInput.value}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      message.textContent = error.message;
    }
  });
  monthInput.addEventListener("change", loadReport);
  loadReport();
});
