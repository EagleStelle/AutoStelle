// monitor.js 
import { auth, db } from './firebase.js';
import { showModal, closeModal } from './ui.js';
import {
  ref,
  onValue,
  set,
  get,
  remove
} from 'https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js';
import { signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js';

// DOM helper
const $ = id => document.getElementById(id);

console.log("[monitor.js] Script loaded");

const modeToggleBtn = document.getElementById("modeToggle");
const mainContainer = document.getElementById("mainContainer");
const adminContainer = document.getElementById("adminContainer");

if (modeToggleBtn && mainContainer && adminContainer) {
  modeToggleBtn.addEventListener("click", () => {
    const isAdminMode = !adminContainer.classList.contains("hidden");
    const icon = modeToggleBtn.querySelector("i");

    if (isAdminMode) {
      adminContainer.classList.add("hidden");
      mainContainer.classList.remove("hidden");
      icon.classList.replace("fa-user", "fa-gear"); // Switch to admin icon
    } else {
      adminContainer.classList.remove("hidden");
      mainContainer.classList.add("hidden");
      icon.classList.replace("fa-gear", "fa-user"); // Switch to user icon
    }
  });
}

const reserveBtn = $('reserve');
const cancelScanBtn = $('cancelScan');
const logoutBtn = $('logout');
const controlPanel = $('controlPanel');

let isScanning = false;
let stopScan = null;

async function clearScan() {
  isScanning = false;
  console.log("[clearScan] Clearing scan flags in database...");
  try {
    await Promise.all([
      set(ref(db, 'scanMode'), false),
      set(ref(db, 'lastScannedUID'), "")
    ]);
    console.log("[clearScan] Scan mode cleared");
  } catch (err) {
    console.error('[clearScan] Failed to write DB flags:', err);
  }
  if (typeof stopScan === 'function') {
    console.log("[clearScan] Removing scan listener");
    stopScan();
    stopScan = null;
  }
}

function resetInputFields() {
  const nameEl = document.getElementById("inputName");
  const plateEl = document.getElementById("inputPlate");
  if (nameEl) nameEl.value = "";
  if (plateEl) plateEl.value = "";
  console.log("[resetInputFields] Inputs cleared");
}

function setupLogout() {
  if (!logoutBtn) return;
  logoutBtn.addEventListener('click', () => {
    console.log("[Logout] Attempting sign out...");
    signOut(auth)
      .then(() => {
        console.log("[Logout] Success. Redirecting...");
        window.location.href = 'index.html';
      })
      .catch(err => console.error('[Logout] Failed:', err));
  });
}

function setupReserve() {
  if (!reserveBtn) return;

  reserveBtn.addEventListener("click", () => {
    console.log("[Reserve] Opening addModal");
    showModal("addModal");
  });

  const confirmAddBtn = document.getElementById("confirmAdd");
  const cancelAddBtn = document.getElementById("cancelAdd");

  // Track last processed UID in this scan session
  let lastProcessedUID = null;

  confirmAddBtn?.addEventListener("click", async () => {
    if (!auth.currentUser) {
      console.warn('[Reserve] No authenticated user');
      return;
    }

    const nameInput = document.getElementById("inputName");
    const plateInput = document.getElementById("inputPlate");
    const name = nameInput?.value.trim();
    const plate = plateInput?.value.trim();

    console.log(`[Reserve] Input: name=${name}, plate=${plate}`);

    if (!name || !plate) {
      closeModal("addModal")
      showModal("Please fill all fields.", "error", {
          buttonLabel: "Okay"
        });
      return;
    }

    try {
      // Fetch existing entries
      const authorizedRef = ref(db, "authorizedUIDs");
      const snapshot = await get(authorizedRef);
      const existingUIDs = snapshot.exists() ? snapshot.val() : {};

      // Check duplicates in name/plate
      let nameExists = false, plateExists = false;
      for (const data of Object.values(existingUIDs)) {
        if (data.name === name) nameExists = true;
        if (data.plate === plate) plateExists = true;
      }
      if (nameExists || plateExists) {
        closeModal("addModal");
        resetInputFields();
        showModal(`Name or plate already registered under a different UID.`, "error", {
          buttonLabel: "Okay",
          autoClose: true,
          autoCloseDelay: 1500
        });
        return;
      }

      // Passed validation: prepare scan
      closeModal("addModal");
      // 1. Clear previous UID in database
      console.log("[Reserve] Clearing lastScannedUID before scan...");
      await set(ref(db, "lastScannedUID"), "");
      // 2. Show scan prompt
      showModal("Please scan a tag to reserve.", "info");
      // 3. Enable scan mode
      console.log("[Reserve] Enabling scan mode...");
      await set(ref(db, "scanMode"), true);
      console.log("[Reserve] Scan mode enabled");
      isScanning = true;

      // 4. Listen for new scans
      const scannedRef = ref(db, "lastScannedUID");
      lastProcessedUID = null; // reset for this session
      console.log("[Reserve] Listening to lastScannedUID...");
      stopScan = onValue(scannedRef, async snap => {
        const uid = snap.val();
        console.log("[Reserve] onValue received UID:", uid);

        // Guard: only proceed for a new, non-empty UID while scanning
        if (!isScanning || !uid) return;
        if (uid === lastProcessedUID) return; // already handled
        lastProcessedUID = uid;

        // Now handle the scanned UID
        try {
          const snap2 = await get(ref(db, "authorizedUIDs"));
          const existing = snap2.exists() ? snap2.val() : {};
          if (existing[uid]) {
            resetInputFields();
            showModal(`UID ${uid} is already registered.`, "error", {
              buttonLabel: "Okay",
              autoClose: true,
              autoCloseDelay: 1500
            });
            // After showing error, clear scan
            setTimeout(async () => {
              await clearScan();
              lastProcessedUID = null;
            }, 1500);
            return;
          }
          // Safe to save
          await set(ref(db, `authorizedUIDs/${uid}`), {
            allowed: true,
            name,
            plate
          });
          console.log(`[Reserve] UID ${uid} written to DB`);
          showModal(`UID ${uid} authorized`, "success");
          setTimeout(async () => {
            closeModal(); // closes the scan modal
            await clearScan();
            resetInputFields();
            lastProcessedUID = null;
          }, 2000);
        } catch (err) {
          console.error('[Reserve] Failed to write authorized UID:', err);
          showModal("Failed to authorize UID.", "error");
          setTimeout(async () => {
            await clearScan();
            lastProcessedUID = null;
          }, 1500);
        }
      });
    } catch (err) {
      console.error('[Reserve] Error during validation or setup:', err);
      showModal("Something went wrong during reservation.", "error");
    }
  });

  cancelAddBtn?.addEventListener("click", () => {
    console.log("[Reserve] Cancel clicked");
    closeModal("addModal");
    resetInputFields();
  });
}

function setupCancelScan() {
  if (!cancelScanBtn) return;
  cancelScanBtn.addEventListener('click', async () => {
    console.log("[CancelScan] User cancelled scan");
    closeModal(); 
    await clearScan();
    resetInputFields();
  });
}

function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) return resolve(element);

    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found in time`));
    }, timeout);
  });
}

async function setupRemoveUIDs() {
  console.log("setupRemoveUIDs: waiting for elements…");

  try {
    // Wait for the UI elements:
    const uidList       = await waitForElement("#uidList");
    const bulkBtn       = await waitForElement("#bulkDeleteBtn");
    const selectAllBtn  = await waitForElement("#selectAllBtn");
    const deselectAllBtn= await waitForElement("#deselectAllBtn");
    const panelDiv      = document.getElementById("panelActions");
    const adminDiv      = document.getElementById("adminButtons");
    const searchInput   = document.getElementById("searchInput");
    const sortSelect    = document.getElementById("sortSelect");

    let entries = [];

    function showPanel() {
      panelDiv.classList.remove("hidden");
      adminDiv.classList.add("hidden");
    }
    function showAdmin() {
      panelDiv.classList.add("hidden");
      adminDiv.classList.remove("hidden");
    }

    function renderList(list) {
      const q      = (searchInput.value || "").trim().toLowerCase();
      const sortBy = sortSelect.value || "name";

      // filter
      let filtered = list.filter(item => {
        if (!q) return true;
        return (
          item.uid.toLowerCase().includes(q) ||
          (item.name  || "").toLowerCase().includes(q) ||
          (item.plate || "").toLowerCase().includes(q)
        );
      });

      // sort
      filtered.sort((a, b) => {
        switch (sortBy) {
          case "name":
            return (a.name||"").localeCompare(b.name||"", undefined, {sensitivity:"base"});
          case "uid":
            return a.uid.localeCompare(b.uid, undefined, {sensitivity:"base"});
          case "plate":
            return (a.plate||"").localeCompare(b.plate||"", undefined, {sensitivity:"base"});
          case "newest":
            return (b.timestamp||0) - (a.timestamp||0);
          case "oldest":
            return (a.timestamp||0) - (b.timestamp||0);
          default:
            return 0;
        }
      });

      uidList.innerHTML = "";
      if (filtered.length === 0) {
        uidList.innerHTML = "<p>No matching UIDs.</p>";
        showAdmin();
        return;
      }

      // build cards
      for (const item of filtered) {
        const card = document.createElement("div");
        card.className = "uid-card";

        const cb = document.createElement("input");
        cb.type  = "checkbox";
        cb.className = "uid-checkbox";
        cb.value = item.uid;

        cb.addEventListener("change", () => {
          const any = document.querySelectorAll(".uid-checkbox:checked").length > 0;
          any ? showPanel() : showAdmin();
        });

        const info = document.createElement("div");
        info.className = "uid-info";
        info.innerHTML = `
          <div class="uid-field"><strong>${item.uid}</strong></div>
          <div class="uid-field">${item.name||""}</div>
          <div class="uid-field">${item.plate||""}</div>
        `;

        const del = document.createElement("button");
        del.className = "delete-btn";
        del.dataset.uid = item.uid;
        del.innerHTML = '<i class="fa-solid fa-trash"></i>';
        del.addEventListener("click", async () => {
          try {
            await remove(ref(db, `authorizedUIDs/${item.uid}`));
            showModal(`UID ${item.uid} removed`, "success", {
              buttonLabel: "Okay",
              autoClose: true,
              autoCloseDelay: 1500
            });
          } catch (e) {
            console.error(e);
            showModal("Failed to remove UID.", "error");
          }
        });

        card.append(cb, info, del);
        uidList.appendChild(card);
      }

      // after render, decide which bar to show
      const anyChecked = document.querySelectorAll(".uid-checkbox:checked").length > 0;
      anyChecked ? showPanel() : showAdmin();
    }

    // react to search/sort
    searchInput.addEventListener("input",  () => renderList(entries));
    sortSelect.addEventListener("change", () => renderList(entries));

    // Firebase listener
    onValue(ref(db, "authorizedUIDs"), snap => {
      if (!snap.exists()) {
        entries = [];
        uidList.innerHTML = "<p>No reserved UIDs.</p>";
        showAdmin();
        return;
      }
      entries = Object.entries(snap.val()).map(([uid, info]) => ({
        uid,
        name: info.name || "",
        plate: info.plate || "",
        timestamp: info.timestamp || 0
      }));
      renderList(entries);
    });

    // bulk delete
    bulkBtn.addEventListener("click", async () => {
      const checked = document.querySelectorAll(".uid-checkbox:checked");
      if (!checked.length || !confirm(`Delete ${checked.length} UIDs?`)) return;
      try {
        await Promise.all(
          Array.from(checked).map(cb =>
            remove(ref(db, `authorizedUIDs/${cb.value}`))
          )
        );
        showModal(`${checked.length} UID(s) removed.`, "success", {
          buttonLabel: "Okay",
          autoClose: true,
          autoCloseDelay: 1500
        });
        showAdmin();
      } catch (e) {
        console.error(e);
        showModal("Bulk delete failed.", "error");
      }
    });

    // select/deselect all
    selectAllBtn.addEventListener("click", () => {
      const all = document.querySelectorAll(".uid-checkbox:not(:disabled)");
      if (!all.length) return;
      all.forEach(cb => cb.checked = true);
      showPanel();
    });

    deselectAllBtn.addEventListener("click", () => {
      document.querySelectorAll(".uid-checkbox:not(:disabled)")
              .forEach(cb => cb.checked = false);
      showAdmin();
    });

  } catch (err) {
    console.warn("setupRemoveUIDs failed:", err);
  }
}

function updateSlotUI(slotNumber, isOccupied) {
  const slotMap = {
    1: "A1",
    2: "A2",
    3: "A3",
    4: "R1",
    5: "R2",
    6: "R3"
  };

  const label = slotMap[slotNumber];
  console.log(`[updateSlotUI] slotNumber: ${slotNumber}, label: ${label}, isOccupied: ${isOccupied}`);

  if (!label) {
    console.warn(`[updateSlotUI] No label found for slot ${slotNumber}`);
    return;
  }

  const allSlots = document.querySelectorAll(".slot");
  if (allSlots.length === 0) {
    console.warn("[updateSlotUI] No .slot elements found in DOM");
  }

  allSlots.forEach(el => {
    console.log(`[updateSlotUI] Checking element with text: "${el.textContent.trim()}"`);
    if (el.textContent.trim() === label) {
      console.log(`[updateSlotUI] Updating class for: ${label}, setting occupied = ${isOccupied}`);
      el.classList.toggle("occupied", isOccupied);
    }
  });
}

function listenToParkingSlots() {
  for (let i = 1; i <= 6; i++) {
    const path = `parkingSlots/${i}`;
    const slotRef = ref(db, path);
    console.log(`[listenToParkingSlots] Listening to ${path}`);
    
    onValue(slotRef, (snapshot) => {
      const isOccupied = snapshot.val();
      console.log(`[Firebase] Slot ${i} snapshot value: ${isOccupied}`);
      updateSlotUI(i, isOccupied === true);
    }, (error) => {
      console.error(`[Firebase] Error at slot ${i}:`, error);
    });
  }
}

function authReady() {
  return new Promise(resolve => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      console.log("[authReady] Auth state changed. User:", user?.email || "None");
      if (user) {
        controlPanel?.classList.remove('hidden');
      } else {
        controlPanel?.classList.add('hidden');
      }
      setupLogout();
      setupReserve();
      setupCancelScan();
      setupRemoveUIDs();
      unsubscribe();
      resolve(user);
    });
  });
}

(async () => {
  try {
    console.log("[Init] Waiting for auth...");
    await authReady();
    console.log("[Init] Auth complete");
    listenToParkingSlots();
  } catch (err) {
    console.error('[Init] Initialization error:', err);
  }
})();