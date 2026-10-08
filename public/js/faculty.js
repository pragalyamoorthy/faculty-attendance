document.addEventListener("faculty-app-ready", () => {
  const form = document.querySelector("#faculty-form");
  const message = document.querySelector("#faculty-message");
  let editingId = null;

  function cell(text) {
    const td = document.createElement("td");
    td.textContent = text || "";
    return td;
  }

  async function loadFaculty() {
    const list = await FacultyApp.json("/api/faculty");
    const body = document.querySelector("#faculty-list");
    body.replaceChildren();
    if (!list.length) {
      const row = document.createElement("tr");
      const empty = cell("No faculty members yet.");
      empty.colSpan = 4;
      empty.className = "empty";
      row.append(empty);
      body.append(row);
      return;
    }
    for (const person of list) {
      const row = document.createElement("tr");
      row.append(cell(person.name), cell(person.department), cell(person.email));
      const actions = document.createElement("td");
      actions.className = "actions";
      const edit = document.createElement("button");
      edit.className = "secondary";
      edit.textContent = "Edit";
      edit.addEventListener("click", () => {
        editingId = person.id;
        form.elements.name.value = person.name;
        form.elements.department.value = person.department;
        form.elements.email.value = person.email;
        form.querySelector("button[type=submit]").textContent = "Save changes";
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      const remove = document.createElement("button");
      remove.className = "danger";
      remove.textContent = "Delete";
      remove.addEventListener("click", async () => {
        if (!window.confirm(`Delete ${person.name} and their attendance records?`)) return;
        try {
          await FacultyApp.json(`/api/faculty/${person.id}`, { method: "DELETE" });
          await loadFaculty();
        } catch (error) {
          message.textContent = error.message;
        }
      });
      actions.append(edit, remove);
      row.append(actions);
      body.append(row);
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const details = Object.fromEntries(new FormData(form));
    try {
      await FacultyApp.json(editingId ? `/api/faculty/${editingId}` : "/api/faculty", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(details)
      });
      editingId = null;
      form.reset();
      form.querySelector("button[type=submit]").textContent = "Add faculty";
      message.textContent = "Faculty details saved.";
      await loadFaculty();
    } catch (error) {
      message.textContent = error.message;
    }
  });

  document.querySelector("#cancel-edit").addEventListener("click", () => {
    editingId = null;
    form.reset();
    form.querySelector("button[type=submit]").textContent = "Add faculty";
    message.textContent = "";
  });

  loadFaculty().catch((error) => { message.textContent = error.message; });
});
