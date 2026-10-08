document.addEventListener("faculty-app-ready", () => {
  const dateInput = document.querySelector("#attendance-date");
  const message = document.querySelector("#attendance-message");
  dateInput.value = new Date().toISOString().slice(0, 10);

  async function loadAttendance() {
    message.textContent = "";
    try {
      const rows = await FacultyApp.json(`/api/attendance?date=${encodeURIComponent(dateInput.value)}`);
      const body = document.querySelector("#attendance-list");
      body.replaceChildren();
      if (!rows.length) {
        const row = document.createElement("tr");
        const empty = document.createElement("td");
        empty.colSpan = 4;
        empty.className = "empty";
        empty.textContent = "Add faculty members to start marking attendance.";
        row.append(empty);
        body.append(row);
        return;
      }
      for (const person of rows) {
        const row = document.createElement("tr");
        const name = document.createElement("td");
        const department = document.createElement("td");
        const statusCell = document.createElement("td");
        const actions = document.createElement("td");
        name.textContent = person.name;
        department.textContent = person.department;
        const select = document.createElement("select");
        select.setAttribute("aria-label", `Attendance for ${person.name}`);
        for (const [value, label] of [["present", "Present"], ["absent", "Absent"], ["late", "Late"]]) {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = label;
          select.append(option);
        }
        if (person.status) select.value = person.status;
        statusCell.append(select);
        const save = document.createElement("button");
        save.textContent = "Save";
        save.addEventListener("click", async () => {
          try {
            await FacultyApp.json("/api/attendance", {
              method: "POST",
              body: JSON.stringify({ facultyId: person.facultyId, date: dateInput.value, status: select.value })
            });
            message.textContent = `Attendance saved for ${person.name}.`;
          } catch (error) {
            message.textContent = error.message;
          }
        });
        actions.append(save);
        row.append(name, department, statusCell, actions);
        body.append(row);
      }
    } catch (error) {
      message.textContent = error.message;
    }
  }

  dateInput.addEventListener("change", loadAttendance);
  loadAttendance();
});
