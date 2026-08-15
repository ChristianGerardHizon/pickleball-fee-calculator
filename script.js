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
        courts: [{ fee: 0, payer: "" }],
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

  const ICON_X = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  // Only surfaced when 2+ distinct payer names are set across courts — leaving
  // every court's "Paid by" blank (or all the same name) keeps the app in its
  // original single-owner behavior with no reimbursement breakdown shown.
  // Money already collected from paid participants is attributed to each
  // payer proportionally to the share of the total fee they fronted.
  function getPayerBreakdown(event, totalFee, totalCollected) {
    const payerTotals = new Map();
    event.courts.forEach((c) => {
      const payer = (c.payer || "").trim();
      if (!payer) return;
      const fee = Number(c.fee) || 0;
      payerTotals.set(payer, (payerTotals.get(payer) || 0) + fee);
    });

    if (payerTotals.size < 2) return null;

    const assignedTotal = Array.from(payerTotals.values()).reduce((a, b) => a + b, 0);
    const unassigned = totalFee - assignedTotal;

    const rows = Array.from(payerTotals.entries()).map(([payer, feeSum]) => {
      const share = totalFee > 0 ? feeSum / totalFee : 0;
      const collected = totalCollected * share;
      return { payer, feeSum, collected, remaining: feeSum - collected };
    });

    if (unassigned > 0.004) {
      const share = totalFee > 0 ? unassigned / totalFee : 0;
      const collected = totalCollected * share;
      rows.push({ payer: "Unassigned", feeSum: unassigned, collected, remaining: unassigned - collected });
    }

    return rows;
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
        <div class="court-row-main">
          <span class="court-label">Court ${idx + 1}</span>
          <input type="number" min="0" step="0.01" class="court-fee-input" value="${court.fee}" data-idx="${idx}" />
          <button class="remove-btn" data-idx="${idx}" aria-label="Remove court">${ICON_X}</button>
        </div>
        <input type="text" class="court-payer-input" placeholder="Paid by (optional)" value="${escapeHtml(court.payer || "")}" data-idx="${idx}" />
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
        ${p.paid ? '<span class="paid-badge">Paid</span>' : ""}
        <button class="remove-btn" data-idx="${idx}" aria-label="Remove participant">${ICON_X}</button>
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
    const payerRows = getPayerBreakdown(event, totalFee, collected);

    summaryContentEl.innerHTML = `
      <div class="summary-highlight">
        <span class="summary-highlight-label">Amount per person</span>
        <span class="summary-highlight-value money">${formatCurrency(perPerson)}</span>
      </div>
      <div class="summary-grid">
        <div><span class="label">Courts</span><span class="value">${event.courts.length}</span></div>
        <div><span class="label">Total Fee</span><span class="value money">${formatCurrency(totalFee)}</span></div>
        <div><span class="label">Participants</span><span class="value">${count}</span></div>
        <div><span class="label">Paid</span><span class="value">${paidCount} / ${count}</span></div>
        <div><span class="label">Collected</span><span class="value money">${formatCurrency(collected)}</span></div>
        <div><span class="label">Remaining</span><span class="value money">${formatCurrency(remaining)}</span></div>
      </div>
      ${
        payerRows
          ? `
      <div class="payer-breakdown">
        <h3 class="payer-breakdown-title">Reimbursements</h3>
        ${payerRows
          .map(
            (r) => `
        <div class="payer-row">
          <span class="payer-name">${escapeHtml(r.payer)}</span>
          <div class="payer-amounts">
            <span class="payer-remaining money">${formatCurrency(r.remaining)}<span class="payer-sub">owed</span></span>
            <span class="payer-total money">of ${formatCurrency(r.feeSum)} fronted</span>
          </div>
        </div>`
          )
          .join("")}
      </div>`
          : ""
      }
    `;
  }

  function renderMasterManageList() {
    masterManageListEl.innerHTML = "";
    state.data.masterList.forEach((name, idx) => {
      const row = document.createElement("div");
      row.className = "master-row";
      row.innerHTML = `<span>${escapeHtml(titleCase(name))}</span><button class="remove-btn" data-idx="${idx}" aria-label="Remove from master list">${ICON_X}</button>`;
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
    getCurrentEvent().courts.push({ fee: 0, payer: "" });
    saveData();
    renderCourts();
    renderSummary();
  });

  courtsListEl.addEventListener("input", (e) => {
    const idx = Number(e.target.dataset.idx);
    if (e.target.classList.contains("court-fee-input")) {
      getCurrentEvent().courts[idx].fee = parseFloat(e.target.value) || 0;
      saveData();
      renderSummary();
    } else if (e.target.classList.contains("court-payer-input")) {
      getCurrentEvent().courts[idx].payer = e.target.value;
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

  const SHARE_FONT = '"Plus Jakarta Sans", Arial, sans-serif';
  const shareFont = (weight, size) => `${weight} ${size}px ${SHARE_FONT}`;
  // Peso amounts use a dedicated Arial-only stack (no "Plus Jakarta Sans, Arial"
  // fallback chain) so the whole string resolves to one font. Mixing fonts per
  // request meant the "₱" glyph (missing from Plus Jakarta Sans) silently fell
  // back to Arial's regular weight while the digits stayed at the requested
  // weight, making the peso sign look thin/broken next to bold numbers.
  const MONEY_FONT = "Arial, sans-serif";
  const moneyFont = (weight, size) => `${weight >= 700 ? "bold" : "normal"} ${size}px ${MONEY_FONT}`;
  const SHARE_COLORS = {
    bg: "#f8fafc",
    surface: "#ffffff",
    emerald700: "#047857",
    emerald800: "#065f46",
    emerald50: "#ecfdf5",
    emerald100: "#d1fae5",
    ink900: "#0f172a",
    ink600: "#475569",
    ink500: "#64748b",
    ink200: "#e2e8f0",
  };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawPaddleIcon(ctx, x, y, size, color) {
    const scale = size / 24;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = color;
    roundRect(ctx, 6, 2, 12, 14, 6);
    ctx.fill();
    roundRect(ctx, 10.3, 14.5, 3.4, 7.5, 1.6);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(19, 19, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Flows chip labels left-to-right, wrapping to a new row when they'd
  // overflow maxWidth. Positions are relative to (0,0); the caller offsets
  // them onto the canvas once the card's final y position is known.
  function layoutChips(ctx, labels, maxWidth, chipH, gapX, gapY, padX, font) {
    ctx.font = font;
    let x = 0;
    let y = 0;
    const positions = [];
    labels.forEach((label) => {
      const w = ctx.measureText(label).width + padX * 2;
      if (x > 0 && x + w > maxWidth) {
        x = 0;
        y += chipH + gapY;
      }
      positions.push({ x, y, w, label });
      x += w + gapX;
    });
    return { positions, totalHeight: labels.length ? y + chipH : 0 };
  }

  function generateShareImage() {
    const event = getCurrentEvent();
    const totalFee = event.courts.reduce((sum, c) => sum + (Number(c.fee) || 0), 0);
    const count = event.participants.length;
    const perPerson = count > 0 ? totalFee / count : 0;
    const names = event.participants.map((p) => titleCase(p.name));
    // Reuses the same reimbursement math as the in-app summary, but the
    // canvas only ever reads .payer/.feeSum from it — collected/remaining
    // are derived from paid status, which this image intentionally excludes.
    const payerRows = getPayerBreakdown(event, totalFee, 0);

    const W = 800;
    const PAD = 40;
    const CW = W - PAD * 2;
    const CP = 24;
    const INNER_W = CW - CP * 2;

    const canvas = shareCanvasEl;
    canvas.width = W;
    canvas.height = 200;
    const ctx = canvas.getContext("2d");

    // ----- measurement pass -----
    const HEADER_H = 104;
    const HIGHLIGHT_H = 116;
    const courtRowH = 30;
    const courtsCardH =
      CP + 22 + 16 + (event.courts.length > 0 ? event.courts.length * courtRowH : courtRowH) + 16 + 24 + CP;
    const payerRowH = 30;
    const payerCardH = payerRows ? CP + 22 + 16 + payerRows.length * payerRowH + CP : 0;

    const chips = layoutChips(
      ctx,
      names.length ? names : ["No participants yet"],
      INNER_W,
      34,
      10,
      10,
      14,
      shareFont(600, 14)
    );
    const participantsCardH = CP + 22 + 16 + chips.totalHeight + CP;

    const GAP = 20;
    const totalHeight =
      HEADER_H +
      GAP +
      HIGHLIGHT_H +
      GAP +
      courtsCardH +
      GAP +
      (payerRows ? payerCardH + GAP : 0) +
      participantsCardH +
      GAP +
      30;

    canvas.width = W;
    canvas.height = totalHeight;

    // ----- draw pass -----
    ctx.fillStyle = SHARE_COLORS.bg;
    ctx.fillRect(0, 0, W, totalHeight);

    // header
    ctx.fillStyle = SHARE_COLORS.emerald700;
    ctx.fillRect(0, 0, W, HEADER_H);
    const badgeSize = 52;
    const badgeY = (HEADER_H - badgeSize) / 2;
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    roundRect(ctx, PAD, badgeY, badgeSize, badgeSize, 14);
    ctx.fill();
    drawPaddleIcon(ctx, PAD + (badgeSize - 26) / 2, badgeY + (badgeSize - 26) / 2, 26, "#ffffff");

    const textX = PAD + badgeSize + 16;
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.font = shareFont(800, 25);
    ctx.fillText("Pickleball Court Fees", textX, HEADER_H / 2 - 4);
    ctx.font = shareFont(500, 15);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(formatDateLabel(state.currentDate), textX, HEADER_H / 2 + 20);

    // highlight card
    let y = HEADER_H + GAP;
    ctx.fillStyle = SHARE_COLORS.emerald700;
    roundRect(ctx, PAD, y, CW, HIGHLIGHT_H, 16);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = shareFont(600, 14);
    ctx.fillText("AMOUNT PER PERSON", PAD + CP, y + 38);
    ctx.fillStyle = "#ffffff";
    ctx.font = moneyFont(700, 44);
    ctx.fillText(formatCurrency(perPerson), PAD + CP, y + 86);

    const statX = PAD + CW - CP;
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = shareFont(600, 13);
    ctx.fillText("TOTAL POOL", statX, y + 38);
    ctx.fillStyle = "#ffffff";
    ctx.font = moneyFont(700, 22);
    ctx.fillText(formatCurrency(totalFee), statX, y + 64);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = shareFont(600, 13);
    ctx.fillText("PARTICIPANTS", statX, y + 90);
    ctx.fillStyle = "#ffffff";
    ctx.font = shareFont(700, 20);
    ctx.fillText(String(count), statX, y + 112);
    ctx.textAlign = "left";

    // court fees card
    y += HIGHLIGHT_H + GAP;
    ctx.fillStyle = SHARE_COLORS.surface;
    roundRect(ctx, PAD, y, CW, courtsCardH, 16);
    ctx.fill();
    ctx.strokeStyle = SHARE_COLORS.ink200;
    ctx.lineWidth = 1.5;
    roundRect(ctx, PAD, y, CW, courtsCardH, 16);
    ctx.stroke();

    let cy = y + CP + 6;
    ctx.fillStyle = SHARE_COLORS.ink900;
    ctx.font = shareFont(700, 16);
    ctx.fillText("Court Fees", PAD + CP, cy);
    cy += 30;

    if (event.courts.length === 0) {
      ctx.fillStyle = SHARE_COLORS.ink500;
      ctx.font = shareFont(500, 14);
      ctx.fillText("No courts added", PAD + CP, cy);
      cy += courtRowH;
    } else {
      event.courts.forEach((c, idx) => {
        ctx.fillStyle = SHARE_COLORS.ink600;
        ctx.font = shareFont(500, 15);
        ctx.textAlign = "left";
        ctx.fillText(`Court ${idx + 1}`, PAD + CP, cy);
        ctx.fillStyle = SHARE_COLORS.ink900;
        ctx.font = moneyFont(700, 15);
        ctx.textAlign = "right";
        ctx.fillText(formatCurrency(c.fee), PAD + CW - CP, cy);
        ctx.textAlign = "left";
        cy += courtRowH;
      });
    }

    cy += 4;
    ctx.strokeStyle = SHARE_COLORS.ink200;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD + CP, cy);
    ctx.lineTo(PAD + CW - CP, cy);
    ctx.stroke();
    cy += 26;

    ctx.fillStyle = SHARE_COLORS.ink900;
    ctx.font = shareFont(700, 16);
    ctx.textAlign = "left";
    ctx.fillText("Total", PAD + CP, cy);
    ctx.fillStyle = SHARE_COLORS.emerald700;
    ctx.font = moneyFont(700, 17);
    ctx.textAlign = "right";
    ctx.fillText(formatCurrency(totalFee), PAD + CW - CP, cy);
    ctx.textAlign = "left";

    // paid-by card (only when courts have 2+ distinct payers)
    y += courtsCardH + GAP;
    if (payerRows) {
      ctx.fillStyle = SHARE_COLORS.surface;
      roundRect(ctx, PAD, y, CW, payerCardH, 16);
      ctx.fill();
      ctx.strokeStyle = SHARE_COLORS.ink200;
      ctx.lineWidth = 1.5;
      roundRect(ctx, PAD, y, CW, payerCardH, 16);
      ctx.stroke();

      let py = y + CP + 6;
      ctx.fillStyle = SHARE_COLORS.ink900;
      ctx.font = shareFont(700, 16);
      ctx.fillText("Paid By", PAD + CP, py);
      py += 30;

      payerRows.forEach((r) => {
        ctx.fillStyle = SHARE_COLORS.ink600;
        ctx.font = shareFont(500, 15);
        ctx.textAlign = "left";
        ctx.fillText(r.payer, PAD + CP, py);
        ctx.fillStyle = SHARE_COLORS.ink900;
        ctx.font = moneyFont(700, 15);
        ctx.textAlign = "right";
        ctx.fillText(formatCurrency(r.feeSum), PAD + CW - CP, py);
        ctx.textAlign = "left";
        py += payerRowH;
      });

      y += payerCardH + GAP;
    }

    // participants card
    ctx.fillStyle = SHARE_COLORS.surface;
    roundRect(ctx, PAD, y, CW, participantsCardH, 16);
    ctx.fill();
    ctx.strokeStyle = SHARE_COLORS.ink200;
    ctx.lineWidth = 1.5;
    roundRect(ctx, PAD, y, CW, participantsCardH, 16);
    ctx.stroke();

    ctx.fillStyle = SHARE_COLORS.ink900;
    ctx.font = shareFont(700, 16);
    ctx.fillText(`Participants (${count})`, PAD + CP, y + CP + 6);

    const chipsOriginX = PAD + CP;
    const chipsOriginY = y + CP + 6 + 32;
    const chipFont = shareFont(600, 14);
    ctx.font = chipFont;
    const chipLabels = names.length ? names : ["No participants yet"];
    chips.positions.forEach((pos, idx) => {
      const chipX = chipsOriginX + pos.x;
      const chipY = chipsOriginY + pos.y;
      ctx.fillStyle = SHARE_COLORS.emerald50;
      roundRect(ctx, chipX, chipY, pos.w, 34, 17);
      ctx.fill();
      ctx.strokeStyle = SHARE_COLORS.emerald100;
      ctx.lineWidth = 1.5;
      roundRect(ctx, chipX, chipY, pos.w, 34, 17);
      ctx.stroke();
      ctx.fillStyle = SHARE_COLORS.emerald800;
      ctx.fillText(chipLabels[idx], chipX + 14, chipY + 22);
    });

    // footer
    y += participantsCardH + GAP;
    ctx.textAlign = "center";
    ctx.fillStyle = SHARE_COLORS.ink500;
    ctx.font = shareFont(500, 12);
    ctx.fillText("Generated with Pickleball Fee Splitter", W / 2, y + 6);
    ctx.textAlign = "left";

    const dataUrl = canvas.toDataURL("image/png");
    shareImageEl.src = dataUrl;
    downloadLinkEl.href = dataUrl;
    downloadLinkEl.download = `pickleball-${state.currentDate}.png`;
    shareModalEl.classList.remove("hidden");
  }

  async function handleShareClick() {
    try {
      await Promise.all([
        document.fonts.load(shareFont(500, 16)),
        document.fonts.load(shareFont(600, 16)),
        document.fonts.load(shareFont(700, 16)),
        document.fonts.load(shareFont(800, 16)),
      ]);
    } catch (e) {
      // Fall through and render with whatever font is available.
    }
    generateShareImage();
  }

  shareBtn.addEventListener("click", handleShareClick);
  closeModalBtn.addEventListener("click", () => shareModalEl.classList.add("hidden"));
  shareModalEl.addEventListener("click", (e) => {
    if (e.target === shareModalEl) shareModalEl.classList.add("hidden");
  });

  // ---------- Init ----------

  gateDateInput.value = new Date().toISOString().slice(0, 10);
})();
