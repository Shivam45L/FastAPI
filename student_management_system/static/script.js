(() => {
  const API = "";
  const state = { students: [], editingRoll: null, deletingRoll: null, loading: false };
  const $ = (id) => document.getElementById(id);
  const form = $("student-form");
  const modal = $("student-modal");
  const confirmModal = $("confirm-modal");
  const submitButton = $("submit-student");
  const submitLabel = submitButton.querySelector(".submit-label");
  const buttonSpinner = submitButton.querySelector(".button-spinner");
  const avatarPalette = [
    ["#ece9ff", "#695ae1"], ["#e6f7f0", "#218c64"], ["#fff1df", "#bd7918"],
    ["#e7f1ff", "#3d7ed1"], ["#ffe9ee", "#c34d70"], ["#e9f4e5", "#4c8a42"]
  ];

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function initials(name) {
    const parts = String(name || "Student").trim().split(/\s+/).filter(Boolean);
    return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] || "S").slice(0, 2)).toUpperCase();
  }

  function avatarStyle(name) {
    const total = [...String(name || "")].reduce((sum, character) => sum + character.charCodeAt(0), 0);
    const [background, color] = avatarPalette[total % avatarPalette.length];
    return `background:${background};color:${color}`;
  }

  async function apiRequest(path, options = {}) {
    let response;
    try {
      response = await fetch(`${API}${path}`, {
        ...options,
        headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) }
      });
    } catch (error) {
      throw new Error("Could not reach the FastAPI server. Make sure it is running at http://127.0.0.1:8000.");
    }
    const contentType = response.headers.get("content-type") || "";
    const result = contentType.includes("application/json") ? await response.json() : await response.text();
    if (!response.ok) {
      let detail = result && typeof result === "object" ? result.detail : "";
      if (Array.isArray(detail)) detail = detail.map((item) => item.msg).join("; ");
      throw new Error(detail || `Request failed (${response.status}).`);
    }
    return result;
  }

  function studentsFromDatabase(database) {
    return Object.entries(database || {}).map(([roll, data]) => ({
      roll: Number(roll), name: data.name ?? "", marks: Number(data.marks ?? 0),
      address: data.address ?? "", placed: data.placed === true || data.placed === "true"
    })).sort((a, b) => a.roll - b.roll);
  }

  function getVisibleStudents() {
    const query = $("search-input").value.trim().toLowerCase();
    const placement = $("placement-filter").value;
    return state.students.filter((student) => {
      const matchQuery = !query || [student.roll, student.name, student.address, student.marks].some((value) => String(value).toLowerCase().includes(query));
      const matchPlacement = placement === "all" || (placement === "placed" ? student.placed : !student.placed);
      return matchQuery && matchPlacement;
    });
  }

  function renderStats() {
    const total = state.students.length;
    const placed = state.students.filter((student) => student.placed).length;
    const average = total ? state.students.reduce((sum, student) => sum + student.marks, 0) / total : 0;
    $("total-students").textContent = total.toLocaleString();
    $("placed-students").textContent = placed.toLocaleString();
    $("unplaced-students").textContent = (total - placed).toLocaleString();
    $("placed-rate").textContent = `${total ? Math.round((placed / total) * 100) : 0}%`;
    $("average-marks").innerHTML = `${total ? average.toFixed(1) : "0.0"}<small>/ 100</small>`;
    $("nav-count").textContent = total;
    $("record-count").textContent = `${total} ${total === 1 ? "record" : "records"}`;
  }

  function renderTable() {
    const students = getVisibleStudents();
    const body = $("student-table-body");
    if (!students.length) {
      const hasFilters = $("search-input").value.trim() || $("placement-filter").value !== "all";
      body.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon"><svg viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg></div><h3>${hasFilters ? "No matching students" : "No student records yet"}</h3><p>${hasFilters ? "Try changing your search or placement filter." : "Add your first student to get started."}</p>${hasFilters ? '<button class="btn btn-outline" id="empty-clear-filters">Clear filters</button>' : '<button class="btn btn-primary" id="empty-add-student">＋ Add first student</button>'}</div></td></tr>`;
      $("table-summary").textContent = hasFilters ? "No records match your filters" : "No records to display";
      const clear = $("empty-clear-filters");
      if (clear) clear.addEventListener("click", clearFilters);
      const add = $("empty-add-student");
      if (add) add.addEventListener("click", () => openModal());
      return;
    }

    body.innerHTML = students.map((student) => {
      const markValue = Math.max(0, Math.min(100, student.marks));
      return `<tr>
        <td><span class="roll-badge">${escapeHTML(student.roll)}</span></td>
        <td><div class="student-cell"><div class="student-avatar" style="${avatarStyle(student.name)}">${escapeHTML(initials(student.name))}</div><div><div class="student-name">${escapeHTML(student.name)}</div><div class="student-sub">Roll no. ${escapeHTML(student.roll)}</div></div></div></td>
        <td><div class="marks-cell"><span class="marks-number">${escapeHTML(Number(student.marks).toLocaleString(undefined, { maximumFractionDigits: 2 }))}</span><span class="marks-track"><span class="marks-fill" style="display:block;width:${markValue}%"></span></span></div></td>
        <td><div class="address-cell" title="${escapeHTML(student.address)}">${escapeHTML(student.address || "—")}</div></td>
        <td><span class="status-pill ${student.placed ? "status-placed" : "status-unplaced"}">${student.placed ? "Placed" : "Not placed"}</span></td>
        <td><div class="row-actions"><button class="action-button edit" data-action="edit" data-roll="${escapeHTML(student.roll)}" title="Edit student ${escapeHTML(student.name)}" aria-label="Edit student ${escapeHTML(student.name)}"><svg viewBox="0 0 24 24"><path d="m14 5 5 5M4 20l4.5-1 10.8-10.8a2.1 2.1 0 0 0-3-3L5.5 16 4 20Z"/></svg></button><button class="action-button delete" data-action="delete" data-roll="${escapeHTML(student.roll)}" title="Delete student ${escapeHTML(student.name)}" aria-label="Delete student ${escapeHTML(student.name)}"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m-9 0 1 13h8l1-13M10 11v5m4-5v5"/></svg></button></div></td>
      </tr>`;
    }).join("");
    $("table-summary").textContent = `Showing ${students.length} of ${state.students.length} ${state.students.length === 1 ? "student" : "students"}`;
  }

  async function loadStudents({ silent = false } = {}) {
    if (state.loading) return;
    state.loading = true;
    if (!silent) {
      $("student-table-body").innerHTML = '<tr><td colspan="6"><div class="table-message"><span class="spinner"></span>Loading student records...</div></td></tr>';
      $("table-summary").textContent = "Loading records...";
    }
    try {
      const database = await apiRequest("/get_student");
      state.students = studentsFromDatabase(database);
      renderStats();
      renderTable();
    } catch (error) {
      $("student-table-body").innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon"><svg viewBox="0 0 24 24"><path d="M12 8v5m0 3h.01"/><path d="M10.3 4.7 2.8 18a1.7 1.7 0 0 0 1.5 2.5h15.4a1.7 1.7 0 0 0 1.5-2.5l-7.5-13.3a1.9 1.9 0 0 0-3.4 0Z"/></svg></div><h3>Couldn't load student records</h3><p>${escapeHTML(error.message)}</p><button class="btn btn-outline" id="retry-load">Try again</button></div></td></tr>`;
      $("table-summary").textContent = "Unable to load records";
      const retry = $("retry-load");
      if (retry) retry.addEventListener("click", () => loadStudents());
      if (!silent) showToast("Could not load students", error.message, "error");
    } finally {
      state.loading = false;
    }
  }

  function setFormBusy(busy) {
    submitButton.disabled = busy;
    submitLabel.textContent = busy ? "Saving..." : (state.editingRoll === null ? "Save student" : "Update student");
    buttonSpinner.hidden = !busy;
  }

  function showFormError(message) {
    const error = $("form-error");
    error.textContent = message;
    error.hidden = !message;
  }

  function openModal(student = null) {
    form.reset();
    showFormError("");
    state.editingRoll = student ? student.roll : null;
    $("modal-title").textContent = student ? "Edit student details" : "Add a new student";
    $("modal-description").textContent = student ? "Update this student's information below." : "Enter the student's information below.";
    $("roll").disabled = Boolean(student);
    $("roll").value = student ? student.roll : "";
    $("roll-hint").textContent = student ? "Roll number stays the same when editing." : "Must be unique for each student.";
    $("name").value = student ? student.name : "";
    $("marks").value = student ? student.marks : "";
    $("address").value = student ? student.address : "";
    $("placed").value = student && student.placed ? "true" : "false";
    setFormBusy(false);
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    window.setTimeout(() => (student ? $("name") : $("roll")).focus(), 100);
  }

  function closeModal(force = false) {
    if (submitButton.disabled && !force) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    state.editingRoll = null;
  }

  async function submitStudent(event) {
    event.preventDefault();
    showFormError("");
    const roll = Number($("roll").value);
    const marks = Number($("marks").value);
    const name = $("name").value.trim();
    const address = $("address").value.trim();
    if (!Number.isInteger(roll) || roll < 1) return showFormError("Enter a valid positive whole-number roll number.");
    if (!name) return showFormError("Please enter the student's name.");
    if (!Number.isFinite(marks) || marks < 0 || marks > 100) return showFormError("Marks must be between 0 and 100.");
    if (!address) return showFormError("Please enter the student's address or city.");
    const payload = { roll, name, marks, address, placed: $("placed").value === "true" };
    const isEditing = state.editingRoll !== null;
    if (!isEditing && state.students.some((student) => student.roll === roll)) {
      return showFormError(`Roll number ${roll} already exists. Please use a unique roll number.`);
    }
    setFormBusy(true);
    try {
      const path = isEditing ? `/edit_student?roll=${encodeURIComponent(state.editingRoll)}` : "/add_student";
      const result = await apiRequest(path, { method: "POST", body: JSON.stringify(payload) });
      closeModal(true);
      await loadStudents({ silent: true });
      showToast(isEditing ? "Student updated" : "Student added", result.message || (isEditing ? "Student details were updated." : "The new student was added."), "success");
    } catch (error) {
      showFormError(error.message);
    } finally {
      setFormBusy(false);
    }
  }

  function openDeleteConfirmation(roll) {
    const student = state.students.find((entry) => entry.roll === roll);
    if (!student) return;
    state.deletingRoll = roll;
    $("confirm-message").textContent = `You're about to delete ${student.name} (roll no. ${student.roll}). This action cannot be undone.`;
    confirmModal.classList.add("open");
    confirmModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeDeleteConfirmation() {
    confirmModal.classList.remove("open");
    confirmModal.setAttribute("aria-hidden", "true");
    if (!modal.classList.contains("open")) document.body.style.overflow = "";
    state.deletingRoll = null;
  }

  async function deleteStudent() {
    if (state.deletingRoll === null) return;
    const roll = state.deletingRoll;
    const button = $("confirm-delete");
    button.disabled = true;
    button.textContent = "Deleting...";
    try {
      const result = await apiRequest(`/delete_student/${encodeURIComponent(roll)}`, { method: "DELETE" });
      closeDeleteConfirmation();
      await loadStudents({ silent: true });
      showToast("Student deleted", result.message || `Roll number ${roll} was deleted.`, "success");
    } catch (error) {
      showToast("Could not delete student", error.message, "error");
    } finally {
      button.disabled = false;
      button.textContent = "Delete student";
    }
  }

  function showToast(title, message, kind = "success") {
    const region = $("toast-region");
    const toast = document.createElement("div");
    toast.className = `toast toast-${kind}`;
    const symbol = kind === "success" ? "✓" : kind === "error" ? "!" : "i";
    toast.innerHTML = `<span class="toast-icon">${symbol}</span><div class="toast-copy"><strong>${escapeHTML(title)}</strong><p>${escapeHTML(message)}</p></div><button class="toast-close" aria-label="Dismiss notification">×</button>`;
    region.appendChild(toast);
    toast.querySelector(".toast-close").addEventListener("click", () => toast.remove());
    window.setTimeout(() => toast.remove(), 5000);
  }

  function clearFilters() {
    $("search-input").value = "";
    $("placement-filter").value = "all";
    renderTable();
  }

  function exportCSV() {
    const students = getVisibleStudents();
    if (!students.length) {
      showToast("Nothing to export", "No student records match the current filters.", "info");
      return;
    }
    const rows = [["Roll Number", "Name", "Marks", "Address", "Placed"], ...students.map((student) => [student.roll, student.name, student.marks, student.address, student.placed ? "Yes" : "No"])];
    const csv = rows.map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "student-records.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Export ready", `${students.length} student ${students.length === 1 ? "record" : "records"} exported to CSV.`, "success");
  }

  $("add-student-top").addEventListener("click", () => openModal());
  $("close-modal").addEventListener("click", closeModal);
  $("cancel-modal").addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });
  form.addEventListener("submit", submitStudent);
  $("student-table-body").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const roll = Number(button.dataset.roll);
    const student = state.students.find((entry) => entry.roll === roll);
    if (button.dataset.action === "edit" && student) openModal(student);
    if (button.dataset.action === "delete") openDeleteConfirmation(roll);
  });
  $("confirm-delete").addEventListener("click", deleteStudent);
  $("cancel-delete").addEventListener("click", closeDeleteConfirmation);
  confirmModal.addEventListener("click", (event) => { if (event.target === confirmModal) closeDeleteConfirmation(); });
  $("search-input").addEventListener("input", renderTable);
  $("placement-filter").addEventListener("change", renderTable);
  $("clear-filters").addEventListener("click", clearFilters);
  $("refresh-button").addEventListener("click", () => loadStudents());
  $("export-button").addEventListener("click", exportCSV);
  $("back-to-top").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  $("nav-dashboard").addEventListener("click", () => { $("breadcrumb-current").textContent = "Dashboard"; $("sidebar").classList.remove("mobile-open"); });
  $("nav-students").addEventListener("click", () => { $("breadcrumb-current").textContent = "Students"; $("sidebar").classList.remove("mobile-open"); window.setTimeout(() => $("search-input").focus(), 250); });
  $("mobile-menu").addEventListener("click", () => $("sidebar").classList.toggle("mobile-open"));
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); $("search-input").focus(); }
    if (event.key === "Escape") {
      if (modal.classList.contains("open")) closeModal();
      if (confirmModal.classList.contains("open")) closeDeleteConfirmation();
      $("sidebar").classList.remove("mobile-open");
    }
  });
  $("year").textContent = new Date().getFullYear();
  loadStudents();
})();
