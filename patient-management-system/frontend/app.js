// Change this URL if your FastAPI backend runs on a different host or port.
const API_BASE_URL = "http://127.0.0.1:8000";

const state = {
  patients: [],
  displayedPatients: [],
  modalMode: "create",
  selectedPatientId: null,
  backendConnected: false,
};

const $ = (id) => document.getElementById(id);

const els = {
  apiStatus: $("apiStatus"),
  apiStatusText: $("apiStatusText"),
  totalPatients: $("totalPatients"),
  normalPatients: $("normalPatients"),
  underweightPatients: $("underweightPatients"),
  highBmiPatients: $("highBmiPatients"),
  navPatientCount: $("navPatientCount"),
  tableBody: $("patientsTableBody"),
  recordsCount: $("recordsCount"),
  searchInput: $("searchInput"),
  bmiFilter: $("bmiFilter"),
  sortSelect: $("sortSelect"),
  patientModalBackdrop: $("patientModalBackdrop"),
  patientModalTitle: $("patientModalTitle"),
  patientModalSubtitle: $("patientModalSubtitle"),
  patientForm: $("patientForm"),
  patientId: $("patientId"),
  patientIdField: $("patientIdField"),
  patientName: $("patientName"),
  patientCity: $("patientCity"),
  patientAge: $("patientAge"),
  patientGender: $("patientGender"),
  patientHeight: $("patientHeight"),
  patientWeight: $("patientWeight"),
  formError: $("formError"),
  savePatientButton: $("savePatientButton"),
  detailsModalBackdrop: $("detailsModalBackdrop"),
  detailsTitle: $("detailsTitle"),
  detailsSubtitle: $("detailsSubtitle"),
  patientDetailsContent: $("patientDetailsContent"),
  editFromDetailsButton: $("editFromDetailsButton"),
  toastRegion: $("toastRegion"),
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

function patientName(patient) {
  return patient.name || "Unnamed patient";
}

function initials(name) {
  return String(name || "?").trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
}

function avatarTone(id) {
  const tones = ["", "tone-1", "tone-2", "tone-3", "tone-4"];
  const total = String(id || "").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return tones[total % tones.length];
}

function calculateBmi(patient) {
  const bmi = Number(patient.bmi);
  if (Number.isFinite(bmi) && bmi > 0) return bmi;
  const height = Number(patient.height);
  const weight = Number(patient.weight);
  return height > 0 && weight > 0 ? Number((weight / (height * height)).toFixed(2)) : 0;
}

function bmiVerdict(patient) {
  const bmi = calculateBmi(patient);
  // Prefer the API verdict if supplied; otherwise infer one from the BMI value.
  if (patient.verdict) return patient.verdict;
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

function setApiStatus(connected) {
  state.backendConnected = connected;
  els.apiStatus.classList.toggle("connected", connected);
  els.apiStatus.classList.toggle("disconnected", !connected);
  els.apiStatusText.textContent = connected ? "API connected" : "API disconnected";
}

async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });
  } catch (error) {
    setApiStatus(false);
    throw new Error(`Cannot reach the backend at ${API_BASE_URL}. Start FastAPI and check the API URL/CORS settings.`);
  }

  setApiStatus(true);
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : {};

  if (!response.ok) {
    const detail = payload.detail;
    const message = Array.isArray(detail)
      ? detail.map((item) => item.msg || "Invalid value").join(". ")
      : (detail || payload.message || `Request failed (${response.status})`);
    throw new Error(message);
  }
  return payload;
}

async function loadPatients(showMessage = false) {
  els.tableBody.innerHTML = '<tr><td class="loading-cell" colspan="8"><span class="spinner"></span>Loading patient records…</td></tr>';
  try {
    const data = await apiRequest("/view");
    state.patients = Object.entries(data || {}).map(([id, patient]) => ({ id, ...patient }));
    updateSummary();
    renderPatients();
    if (showMessage) showToast("Records refreshed", "The latest patient data has been loaded.");
  } catch (error) {
    state.patients = [];
    updateSummary();
    renderPatients(error.message);
    if (showMessage) showToast("Could not refresh records", error.message, true);
  }
}

function updateSummary() {
  const total = state.patients.length;
  const underweight = state.patients.filter((patient) => bmiVerdict(patient) === "Underweight").length;
  const normal = state.patients.filter((patient) => bmiVerdict(patient) === "Normal").length;
  const high = state.patients.filter((patient) => ["Overweight", "Obese"].includes(bmiVerdict(patient))).length;
  els.totalPatients.textContent = total;
  els.normalPatients.textContent = normal;
  els.underweightPatients.textContent = underweight;
  els.highBmiPatients.textContent = high;
  els.navPatientCount.textContent = total;
}

function statusClass(verdict) {
  return ({
    Normal: "status-normal",
    Underweight: "status-underweight",
    Overweight: "status-overweight",
    Obese: "status-obese",
  })[verdict] || "status-normal";
}

function renderPatients(errorMessage = "") {
  const searchTerm = els.searchInput.value.trim().toLowerCase();
  const bmiFilter = els.bmiFilter.value;
  const [sortKey, sortDirection] = els.sortSelect.value.split("-");

  let rows = state.patients.filter((patient) => {
    const text = `${patient.id} ${patientName(patient)} ${patient.city || ""} ${patient.gender || ""}`.toLowerCase();
    return text.includes(searchTerm) && (bmiFilter === "all" || bmiVerdict(patient) === bmiFilter);
  });

  rows.sort((a, b) => {
    let left;
    let right;
    if (sortKey === "bmi") {
      left = calculateBmi(a); right = calculateBmi(b);
    } else if (sortKey === "age") {
      left = Number(a.age || 0); right = Number(b.age || 0);
    } else {
      left = patientName(a).toLowerCase(); right = patientName(b).toLowerCase();
    }
    const comparison = typeof left === "string" ? left.localeCompare(right) : left - right;
    return sortDirection === "desc" ? -comparison : comparison;
  });

  state.displayedPatients = rows;
  els.recordsCount.textContent = `Showing ${rows.length} of ${state.patients.length} ${state.patients.length === 1 ? "patient" : "patients"}`;

  if (errorMessage) {
    els.tableBody.innerHTML = `<tr><td class="empty-cell" colspan="8"><span class="empty-title">Backend connection unavailable</span>${escapeHtml(errorMessage)}<br><button class="secondary-button" type="button" data-action="retry">Try again</button></td></tr>`;
    els.recordsCount.textContent = "Unable to load records";
    return;
  }

  if (rows.length === 0) {
    const hasFilters = Boolean(searchTerm) || bmiFilter !== "all";
    els.tableBody.innerHTML = `<tr><td class="empty-cell" colspan="8"><span class="empty-title">${hasFilters ? "No matching patients" : "No patient records yet"}</span>${hasFilters ? "Try a different search or filter." : "Add your first patient to get started."}${!hasFilters ? '<br><button class="primary-button" type="button" data-action="add">+ Add patient</button>' : ""}</td></tr>`;
    return;
  }

  els.tableBody.innerHTML = rows.map((patient) => {
    const name = patientName(patient);
    const verdict = bmiVerdict(patient);
    const bmi = calculateBmi(patient);
    const bmiWidth = Math.max(6, Math.min(100, (bmi / 40) * 100));
    const gender = patient.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : "—";
    return `<tr>
      <td><div class="patient-cell"><div class="patient-avatar ${avatarTone(patient.id)}">${escapeHtml(initials(name))}</div><div class="patient-name-wrap"><button class="patient-name" type="button" data-action="view" data-id="${escapeHtml(patient.id)}">${escapeHtml(name)}</button><span class="patient-id">ID: ${escapeHtml(patient.id)}</span></div></div></td>
      <td><strong>${escapeHtml(patient.age ?? "—")}</strong><span class="secondary-text"> / ${escapeHtml(gender)}</span></td>
      <td>${escapeHtml(patient.city || "—")}</td>
      <td>${Number(patient.height || 0).toFixed(2)} <span class="secondary-text">m</span></td>
      <td>${Number(patient.weight || 0).toFixed(1)} <span class="secondary-text">kg</span></td>
      <td><span class="bmi-number">${bmi ? bmi.toFixed(2) : "—"}</span><div class="bmi-scale"><span style="width:${bmiWidth}%"></span></div></td>
      <td><span class="status-badge ${statusClass(verdict)}">${escapeHtml(verdict)}</span></td>
      <td><div class="row-actions"><button class="action-button" type="button" title="View details" aria-label="View ${escapeHtml(name)}" data-action="view" data-id="${escapeHtml(patient.id)}">⌕</button><button class="action-button" type="button" title="Edit patient" aria-label="Edit ${escapeHtml(name)}" data-action="edit" data-id="${escapeHtml(patient.id)}">✎</button><button class="action-button delete-action" type="button" title="Delete patient" aria-label="Delete ${escapeHtml(name)}" data-action="delete" data-id="${escapeHtml(patient.id)}">×</button></div></td>
    </tr>`;
  }).join("");
}

function showToast(title, message, isError = false) {
  const toast = document.createElement("div");
  toast.className = `toast${isError ? " error" : ""}`;
  toast.innerHTML = `<span class="toast-icon" aria-hidden="true">${isError ? "!" : "✓"}</span><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p></div>`;
  els.toastRegion.appendChild(toast);
  window.setTimeout(() => toast.remove(), 4600);
}

function resetForm() {
  els.patientForm.reset();
  els.patientId.disabled = false;
  els.patientIdField.hidden = false;
  els.formError.hidden = true;
  els.formError.textContent = "";
  els.savePatientButton.disabled = false;
}

function openCreateModal() {
  state.modalMode = "create";
  state.selectedPatientId = null;
  resetForm();
  els.patientModalTitle.textContent = "Add a patient";
  els.patientModalSubtitle.textContent = "Fill in the information below to create a record.";
  els.savePatientButton.textContent = "Save patient";
  els.patientModalBackdrop.hidden = false;
  document.body.style.overflow = "hidden";
  els.patientId.focus();
}

function openEditModal(patient) {
  state.modalMode = "edit";
  state.selectedPatientId = patient.id;
  resetForm();
  els.patientModalTitle.textContent = "Edit patient";
  els.patientModalSubtitle.textContent = `Update the details for ${patientName(patient)}.`;
  els.savePatientButton.textContent = "Save changes";
  els.patientId.value = patient.id;
  els.patientId.disabled = true;
  els.patientName.value = patient.name || "";
  els.patientCity.value = patient.city || "";
  els.patientAge.value = patient.age ?? "";
  els.patientGender.value = patient.gender || "";
  els.patientHeight.value = patient.height ?? "";
  els.patientWeight.value = patient.weight ?? "";
  els.patientModalBackdrop.hidden = false;
  document.body.style.overflow = "hidden";
  els.patientName.focus();
}

function closePatientModal() {
  els.patientModalBackdrop.hidden = true;
  document.body.style.overflow = "";
}

function openDetailsModal(patient) {
  state.selectedPatientId = patient.id;
  const name = patientName(patient);
  const verdict = bmiVerdict(patient);
  const bmi = calculateBmi(patient);
  els.detailsTitle.textContent = name;
  els.detailsSubtitle.textContent = `Patient ID: ${patient.id}`;
  els.patientDetailsContent.innerHTML = `
    <div class="detail-hero"><div class="patient-avatar ${avatarTone(patient.id)}">${escapeHtml(initials(name))}</div><div><div class="detail-person-name">${escapeHtml(name)}</div><div class="detail-person-meta">${escapeHtml(patient.city || "City not provided")} · ${escapeHtml(patient.age ?? "—")} years</div></div></div>
    <div class="detail-bmi-card"><div><span>Body mass index (BMI)</span><strong>${bmi ? bmi.toFixed(2) : "—"}</strong></div><span class="status-badge ${statusClass(verdict)}">${escapeHtml(verdict)}</span></div>
    <div class="detail-grid">
      <div class="detail-item"><span>Gender</span><strong>${escapeHtml(patient.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : "—")}</strong></div>
      <div class="detail-item"><span>City</span><strong>${escapeHtml(patient.city || "—")}</strong></div>
      <div class="detail-item"><span>Height</span><strong>${Number(patient.height || 0).toFixed(2)} m</strong></div>
      <div class="detail-item"><span>Weight</span><strong>${Number(patient.weight || 0).toFixed(1)} kg</strong></div>
    </div>`;
  els.detailsModalBackdrop.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeDetailsModal() {
  els.detailsModalBackdrop.hidden = true;
  document.body.style.overflow = "";
}

async function submitPatientForm(event) {
  event.preventDefault();
  els.formError.hidden = true;

  const patientId = els.patientId.value.trim().toUpperCase();
  const patient = {
    id: patientId,
    name: els.patientName.value.trim(),
    city: els.patientCity.value.trim(),
    age: Number(els.patientAge.value),
    gender: els.patientGender.value,
    height: Number(els.patientHeight.value),
    weight: Number(els.patientWeight.value),
  };

  if (!patient.name || !patient.city || !patient.gender || !patient.id) {
    els.formError.textContent = "Please complete all required fields.";
    els.formError.hidden = false;
    return;
  }
  if (!Number.isInteger(patient.age) || patient.age < 1 || patient.age >= 120) {
    els.formError.textContent = "Age must be a whole number between 1 and 119.";
    els.formError.hidden = false;
    return;
  }
  if (!(patient.height > 0) || !(patient.weight > 0)) {
    els.formError.textContent = "Height and weight must be greater than zero.";
    els.formError.hidden = false;
    return;
  }

  const isEdit = state.modalMode === "edit";
  const payload = isEdit ? { ...patient, id: undefined } : patient;
  if (isEdit) delete payload.id;
  const path = isEdit ? `/edit/${encodeURIComponent(state.selectedPatientId)}` : "/create";
  els.savePatientButton.disabled = true;
  els.savePatientButton.textContent = isEdit ? "Saving…" : "Creating…";

  try {
    const result = await apiRequest(path, {
      method: isEdit ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });
    closePatientModal();
    showToast(isEdit ? "Patient updated" : "Patient created", result.message || "Changes saved successfully.");
    await loadPatients();
  } catch (error) {
    els.formError.textContent = error.message;
    els.formError.hidden = false;
    showToast(isEdit ? "Could not update patient" : "Could not create patient", error.message, true);
  } finally {
    els.savePatientButton.disabled = false;
    els.savePatientButton.textContent = isEdit ? "Save changes" : "Save patient";
  }
}

async function deletePatient(id) {
  const patient = state.patients.find((item) => item.id === id);
  if (!patient) return;
  const confirmed = window.confirm(`Delete ${patientName(patient)} (${id})? This action cannot be undone.`);
  if (!confirmed) return;
  try {
    const result = await apiRequest(`/delete/${encodeURIComponent(id)}`, { method: "DELETE" });
    showToast("Patient deleted", result.message || `${patientName(patient)} was removed.`);
    await loadPatients();
  } catch (error) {
    showToast("Could not delete patient", error.message, true);
  }
}

function closeAnyModalOnEscape(event) {
  if (event.key === "Escape") {
    closePatientModal();
    closeDetailsModal();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    els.searchInput.focus();
  }
}

$("addPatientButton").addEventListener("click", openCreateModal);
$("refreshButton").addEventListener("click", () => loadPatients(true));
$("navPatients").addEventListener("click", () => $("patientsPanel").scrollIntoView({ behavior: "smooth", block: "start" }));
$("closePatientModal").addEventListener("click", closePatientModal);
$("cancelPatientModal").addEventListener("click", closePatientModal);
$("closeDetailsModal").addEventListener("click", closeDetailsModal);
$("closeDetailsButton").addEventListener("click", closeDetailsModal);
$("editFromDetailsButton").addEventListener("click", () => {
  const patient = state.patients.find((item) => item.id === state.selectedPatientId);
  closeDetailsModal();
  if (patient) openEditModal(patient);
});
els.patientForm.addEventListener("submit", submitPatientForm);
els.searchInput.addEventListener("input", () => renderPatients());
els.bmiFilter.addEventListener("change", () => renderPatients());
els.sortSelect.addEventListener("change", () => renderPatients());
window.addEventListener("keydown", closeAnyModalOnEscape);

els.tableBody.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  const id = button.dataset.id;
  if (action === "retry") return loadPatients(true);
  if (action === "add") return openCreateModal();
  const patient = state.patients.find((item) => item.id === id);
  if (!patient) return;
  if (action === "view") openDetailsModal(patient);
  if (action === "edit") openEditModal(patient);
  if (action === "delete") await deletePatient(id);
});

els.patientModalBackdrop.addEventListener("click", (event) => {
  if (event.target === els.patientModalBackdrop) closePatientModal();
});
els.detailsModalBackdrop.addEventListener("click", (event) => {
  if (event.target === els.detailsModalBackdrop) closeDetailsModal();
});

loadPatients();
