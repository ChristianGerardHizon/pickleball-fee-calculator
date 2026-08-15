(() => {
  "use strict";

  const APP_PASSWORD = "hizon";
  const STORAGE_KEY = "pickleball-fee-splitter-data";

  // ---------- Persistence ----------

  function loadData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          return {
            masterList: Array.isArray(parsed.masterList) ? parsed.masterList : [],
            events: parsed.events && typeof parsed.events === "object" ? parsed.events : {},
          };
        }
      } catch (e) {
        console.warn("Could not parse saved data, starting fresh.", e);
      }
    }
    return { masterList: [], events: {} };
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
  }

  const state = {
    data: loadData(),
    currentDate: null,
  };

  function getCurrentEvent() {
    return state.data.events[state.currentDate];
  }

  function createEventIfNeeded(date) {
    if (!state.data.events[date]) {
      state.data.events[date] = {
        courts: [{ fee: 0 }],
        participants: state.data.masterList.map((name) => ({ name, paid: false })),
        createdAt: new Date().toISOString(),
      };
    }
  }

  // ---------- Helpers ----------

  function titleCase(str) {
    return str
      .trim()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }

  function parseNames(text) {
    return text
      .split("\n")
      .map((line) => line.replace(/^\s*\d+[.)]\s*/, "").trim())
      .filter(Boolean)
      .map(titleCase);
  }

  function mergeNamesIntoMaster(names) {
    names.forEach((name) => {
      const exists = state.data.masterList.some((m) => m.toLowerCase() === name.toLowerCase());
      if (!exists) state.data.masterList.push(name);
    });
  }

  function addParticipantsToEvent(names) {
    const event = getCurrentEvent();
    names.forEach((name) => {
      const exists = event.participants.some((p) => p.name.toLowerCase() === name.toLowerCase());
      if (!exists) event.participants.push({ name, paid: false });
    });
  }

  function formatCurrency(amount) {
    const n = Number(amount) || 0;
    return "₱" + n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatDateLabel(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------- DOM refs ----------

  const gateScreenEl = document.getElementById("gate-screen");
  const mainScreenEl = document.getElementById("main-screen");
  const gateDateInput = document.getElementById("gate-date");
  const gatePasswordInput = document.getElementById("gate-password");
  const gateSubmitBtn = document.getElementById("gate-submit");
  const gateErrorEl = document.getElementById("gate-error");

  const eventDateLabelEl = document.getElementById("event-date-label");
  const switchEventBtn = document.getElementById("switch-event-btn");

  const courtsListEl = document.getElementById("courts-list");
  const addCourtBtn = document.getElementById("add-court-btn");

  const massInputEl = document.getElementById("mass-input");
  const massAddBtn = document.getElementById("mass-add-btn");
  const quickAddInput = document.getElementById("quick-add-input");
  const quickAddBtn = document.getElementById("quick-add-btn");
  const masterChipsEl = document.getElementById("master-chips");
  const participantsListEl = document.getElementById("participants-list");

  const summaryContentEl = document.getElementById("summary-content");
  const shareBtn = document.getElementById("share-btn");
  const masterManageListEl = document.getElementById("master-manage-list");

  const shareModalEl = document.getElementById("share-modal");
  const shareCanvasEl = document.getElementById("share-canvas");
  const shareImageEl = document.getElementById("share-image");
  const downloadLinkEl = document.getElementById("download-link");
  const closeModalBtn = document.getElementById("close-modal-btn");

  // ---------- Rendering ----------

  function renderAll() {
    renderCourts();
    renderParticipants();
    renderMasterChips();
    renderSummary();
    renderMasterManageList();
  }

  function renderCourts() {
    const event = getCurrentEvent();
    courtsListEl.innerHTML = "";
    event.courts.forEach((court, idx) => {
      const row = document.createElement("div");
      row.className = "court-row";
      row.innerHTML = `
        <span class="court-label">Court ${idx + 1}</span>
        <input type="number" min="0" step="0.01" class="court-fee-input" value="${court.fee}" data-idx="${idx}" />
        <button class="remove-btn" data-idx="${idx}" aria-label="Remove court">&times;</button>
      `;
      courtsListEl.appendChild(row);
    });
  }

  function renderParticipants() {
    const event = getCurrentEvent();
    participantsListEl.innerHTML = "";
    event.participants.forEach((p, idx) => {
      const row = document.createElement("div");
      row.className = "participant-row" + (p.paid ? " paid" : "");
      row.innerHTML = `
        <label class="participant-check">
          <input type="checkbox" class="paid-checkbox" data-idx="${idx}" ${p.paid ? "checked" : ""} />
          <span>${escapeHtml(titleCase(p.name))}</span>
        </label>
        <button class="remove-btn" data-idx="${idx}" aria-label="Remove participant">&times;</button>
      `;
      participantsListEl.appendChild(row);
    });
  }

  function renderMasterChips() {
    const event = getCurrentEvent();
    const currentNames = new Set(event.participants.map((p) => p.name.toLowerCase()));
    const available = state.data.masterList.filter((m) => !currentNames.has(m.toLowerCase()));
    masterChipsEl.innerHTML = "";
    if (available.length === 0) return;

    const label = document.createElement("div");
    label.className = "chips-label";
    label.textContent = "Add from master list:";
    masterChipsEl.appendChild(label);

    available.forEach((name) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = "+ " + titleCase(name);
      chip.dataset.name = name;
      masterChipsEl.appendChild(chip);
    });
  }

  function renderSummary() {
    const event = getCurrentEvent();
    const totalFee = event.courts.reduce((sum, c) => sum + (Number(c.fee) || 0), 0);
    const count = event.participants.length;
    const perPerson = count > 0 ? totalFee / count : 0;
    const paidCount = event.participants.filter((p) => p.paid).length;
    const collected = paidCount * perPerson;
    const remaining = totalFee - collected;

    summaryContentEl.innerHTML = `
      <div class="summary-highlight">
        <span class="summary-highlight-label">Amount per person</span>
        <span class="summary-highlight-value">${formatCurrency(perPerson)}</span>
      </div>
      <div class="summary-grid">
        <div><span class="label">Courts</span><span class="value">${event.courts.length}</span></div>
        <div><span class="label">Total Fee</span><span class="value">${formatCurrency(totalFee)}</span></div>
        <div><span class="label">Participants</span><span class="value">${count}</span></div>
        <div><span class="label">Paid</span><span class="value">${paidCount} / ${count}</span></div>
        <div><span class="label">Collected</span><span class="value">${formatCurrency(collected)}</span></div>
        <div><span class="label">Remaining</span><span class="value">${formatCurrency(remaining)}</span></div>
      </div>
    `;
  }

  function renderMasterManageList() {
    masterManageListEl.innerHTML = "";
    state.data.masterList.forEach((name, idx) => {
      const row = document.createElement("div");
      row.className = "master-row";
      row.innerHTML = `<span>${escapeHtml(titleCase(name))}</span><button class="remove-btn" data-idx="${idx}" aria-label="Remove from master list">&times;</button>`;
      masterManageListEl.appendChild(row);
    });
  }

  function showMainScreen() {
    gateScreenEl.classList.add("hidden");
    mainScreenEl.classList.remove("hidden");
    eventDateLabelEl.textContent = formatDateLabel(state.currentDate);
    renderAll();
  }

  function showGateScreen() {
    mainScreenEl.classList.add("hidden");
    gateScreenEl.classList.remove("hidden");
    gatePasswordInput.value = "";
    gateErrorEl.textContent = "";
  }

  function showGateError(msg) {
    gateErrorEl.textContent = msg;
  }

  // ---------- Event listeners ----------

  gateSubmitBtn.addEventListener("click", () => {
    const date = gateDateInput.value;
    const pw = gatePasswordInput.value;
    if (!date) {
      showGateError("Please select an event date.");
      return;
    }
    if (pw.trim().toLowerCase() !== APP_PASSWORD) {
      showGateError("Incorrect password.");
      return;
    }
    state.currentDate = date;
    createEventIfNeeded(date);
    saveData();
    showMainScreen();
  });

  gatePasswordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") gateSubmitBtn.click();
  });

  switchEventBtn.addEventListener("click", showGateScreen);

  addCourtBtn.addEventListener("click", () => {
    getCurrentEvent().courts.push({ fee: 0 });
    saveData();
    renderCourts();
    renderSummary();
  });

  courtsListEl.addEventListener("input", (e) => {
    if (e.target.classList.contains("court-fee-input")) {
      const idx = Number(e.target.dataset.idx);
      getCurrentEvent().courts[idx].fee = parseFloat(e.target.value) || 0;
      saveData();
      renderSummary();
    }
  });

  courtsListEl.addEventListener("click", (e) => {
    if (e.target.classList.contains("remove-btn")) {
      const idx = Number(e.target.dataset.idx);
      getCurrentEvent().courts.splice(idx, 1);
      saveData();
      renderCourts();
      renderSummary();
    }
  });

  massAddBtn.addEventListener("click", () => {
    const names = parseNames(massInputEl.value);
    if (names.length === 0) return;
    mergeNamesIntoMaster(names);
    addParticipantsToEvent(names);
    saveData();
    massInputEl.value = "";
    renderAll();
  });

  quickAddBtn.addEventListener("click", () => {
    const val = quickAddInput.value.trim();
    if (!val) return;
    const name = titleCase(val);
    mergeNamesIntoMaster([name]);
    addParticipantsToEvent([name]);
    saveData();
    quickAddInput.value = "";
    renderAll();
  });

  quickAddInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") quickAddBtn.click();
  });

  masterChipsEl.addEventListener("click", (e) => {
    if (e.target.classList.contains("chip")) {
      addParticipantsToEvent([e.target.dataset.name]);
      saveData();
      renderAll();
    }
  });

  participantsListEl.addEventListener("change", (e) => {
    if (e.target.classList.contains("paid-checkbox")) {
      const idx = Number(e.target.dataset.idx);
      getCurrentEvent().participants[idx].paid = e.target.checked;
      saveData();
      renderParticipants();
      renderSummary();
    }
  });

  participantsListEl.addEventListener("click", (e) => {
    if (e.target.classList.contains("remove-btn")) {
      const idx = Number(e.target.dataset.idx);
      getCurrentEvent().participants.splice(idx, 1);
      saveData();
      renderAll();
    }
  });

  masterManageListEl.addEventListener("click", (e) => {
    if (e.target.classList.contains("remove-btn")) {
      const idx = Number(e.target.dataset.idx);
      state.data.masterList.splice(idx, 1);
      saveData();
      renderMasterManageList();
      renderMasterChips();
    }
  });

  // ---------- Shareable image ----------

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function generateShareImage() {
    const event = getCurrentEvent();
    const totalFee = event.courts.reduce((sum, c) => sum + (Number(c.fee) || 0), 0);
    const count = event.participants.length;
    const perPerson = count > 0 ? totalFee / count : 0;
    const names = event.participants.map((p) => titleCase(p.name));

    const width = 800;
    const padding = 40;
    const cols = names.length > 12 ? 3 : 2;
    const rows = Math.max(1, Math.ceil(names.length / cols));
    const rowHeight = 32;
    const namesHeight = rows * rowHeight;
    const courtsHeight = event.courts.length * 26;
    const height = 300 + courtsHeight + namesHeight + 70;

    const canvas = shareCanvasEl;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    // background
    ctx.fillStyle = "#f4f9f7";
    ctx.fillRect(0, 0, width, height);

    // header
    ctx.fillStyle = "#0f766e";
    ctx.fillRect(0, 0, width, 90);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.font = "bold 28px Arial";
    ctx.fillText("🏓 Pickleball Court Fees", padding, 45);
    ctx.font = "16px Arial";
    ctx.fillText(formatDateLabel(state.currentDate), padding, 72);

    // highlight box
    const boxY = 112;
    const boxH = 90;
    ctx.fillStyle = "#0f766e";
    roundRect(ctx, padding, boxY, width - padding * 2, boxH, 12);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "16px Arial";
    ctx.fillText("Amount per person", padding + 24, boxY + 30);
    ctx.font = "bold 40px Arial";
    ctx.fillText(formatCurrency(perPerson), padding + 24, boxY + 72);

    // court breakdown
    let y = boxY + boxH + 46;
    ctx.fillStyle = "#111827";
    ctx.font = "bold 18px Arial";
    ctx.fillText("Court Fees", padding, y);
    y += 26;
    ctx.font = "15px Arial";
    event.courts.forEach((c, idx) => {
      ctx.textAlign = "left";
      ctx.fillText(`Court ${idx + 1}`, padding, y);
      ctx.textAlign = "right";
      ctx.fillText(formatCurrency(c.fee), width - padding, y);
      y += 26;
    });

    ctx.textAlign = "left";
    ctx.font = "bold 16px Arial";
    ctx.fillText("Total", padding, y);
    ctx.textAlign = "right";
    ctx.fillText(formatCurrency(totalFee), width - padding, y);
    ctx.textAlign = "left";
    y += 26;

    ctx.strokeStyle = "#d1d5db";
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
    y += 30;

    ctx.font = "bold 18px Arial";
    ctx.fillText(`Participants (${count})`, padding, y);
    y += 24;

    ctx.font = "15px Arial";
    const colWidth = (width - padding * 2) / cols;
    names.forEach((name, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = padding + col * colWidth;
      const ny = y + row * rowHeight;
      ctx.fillText(`• ${name}`, x, ny);
    });

    y += rows * rowHeight + 20;
    ctx.font = "italic 12px Arial";
    ctx.fillStyle = "#6b7280";
    ctx.fillText("Generated with Pickleball Fee Splitter", padding, y);

    const dataUrl = canvas.toDataURL("image/png");
    shareImageEl.src = dataUrl;
    downloadLinkEl.href = dataUrl;
    downloadLinkEl.download = `pickleball-${state.currentDate}.png`;
    shareModalEl.classList.remove("hidden");
  }

  shareBtn.addEventListener("click", generateShareImage);
  closeModalBtn.addEventListener("click", () => shareModalEl.classList.add("hidden"));
  shareModalEl.addEventListener("click", (e) => {
    if (e.target === shareModalEl) shareModalEl.classList.add("hidden");
  });

  // ---------- Init ----------

  gateDateInput.value = new Date().toISOString().slice(0, 10);
})();
