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
    console.log(`Mode toggled. Admin mode: ${!isAdminMode}`);

    if (isAdminMode) {
      adminContainer.classList.add("hidden");
      mainContainer.classList.remove("hidden");
      modeToggleBtn.textContent = "Admin Mode";
    } else {
      adminContainer.classList.remove("hidden");
      mainContainer.classList.add("hidden");
      modeToggleBtn.textContent = "User Mode";
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
  console.log("setupRemoveUIDs: waiting for elements...");

  try {
    // Wait for the UI elements:
    const uidList = await waitForElement("#uidList");
    const bulkBtn = await waitForElement("#bulkDeleteBtn");
    const selectAllBtn = await waitForElement("#selectAllBtn");
    const panelActions = document.getElementById("panelActions");

    // Search and sort inputs:
    const searchInput = document.getElementById("searchInput");
    const sortSelect = document.getElementById("sortSelect");

    // Keep the latest snapshot entries here
    let entries = [];

    // Helper: filter & sort entries, then render into uidList
    function renderList(entriesArray) {
      const q = searchInput?.value.trim().toLowerCase() || "";
      const sortBy = sortSelect?.value || "name";

      // 1. Filter
      let filtered = entriesArray.filter(item => {
        // Check if any field contains the query substring
        if (!q) return true;
        // Search in uid, name, plate
        return (
          item.uid.toLowerCase().includes(q) ||
          (item.name && item.name.toLowerCase().includes(q)) ||
          (item.plate && item.plate.toLowerCase().includes(q))
        );
      });

      // 2. Sort
      filtered.sort((a, b) => {
        switch (sortBy) {
          case "name":
            // alphabetical by name (empty names last)
            return (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: 'base' });
          case "uid":
            return a.uid.localeCompare(b.uid, undefined, { sensitivity: 'base' });
          case "plate":
            return (a.plate || "").localeCompare(b.plate || "", undefined, { sensitivity: 'base' });
          case "newest":
            // newest first: higher timestamp first
            return (b.timestamp || 0) - (a.timestamp || 0);
          case "oldest":
            return (a.timestamp || 0) - (b.timestamp || 0);
          default:
            return 0;
        }
      });

      // 3. Render
      if (filtered.length === 0) {
        uidList.innerHTML = "<p>No matching UIDs.</p>";
        panelActions.classList.add("hidden");
        return;
      }

      // Build HTML
      uidList.innerHTML = "";
      for (const item of filtered) {
        const { uid, name, plate } = item;
        const card = document.createElement("div");
        card.className = "uid-card";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "uid-checkbox";
        checkbox.value = uid;

        checkbox.addEventListener("change", () => {
          const anyChecked = document.querySelectorAll(".uid-checkbox:checked").length > 0;
          panelActions.classList.toggle("hidden", !anyChecked);
        });

        const infoWrapper = document.createElement("div");
        infoWrapper.className = "uid-info";
        infoWrapper.innerHTML = `
          <div class="uid-field"><strong>${uid}</strong></div>
          <div class="uid-field">${name || ""}</div>
          <div class="uid-field">${plate || ""}</div>
        `;

        const delBtn = document.createElement("button");
        delBtn.className = "delete-btn";
        delBtn.dataset.uid = uid;
        delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
        delBtn.addEventListener("click", async () => {
          try {
            await remove(ref(db, `authorizedUIDs/${uid}`));
            showModal(`UID ${uid} removed`, "success", {
              buttonLabel: "Okay",
              autoClose: true,
              autoCloseDelay: 1500
            });
            // onValue listener will re-fetch and re-render entries
          } catch (err) {
            console.error("Failed to remove UID", err);
            showModal("Failed to remove UID.", "error");
          }
        });

        card.append(checkbox, infoWrapper, delBtn);
        uidList.appendChild(card);
      }

      // After rendering, if any checkbox is already checked (due to e.g. previous state), show panel
      const anyCheckedNow = document.querySelectorAll(".uid-checkbox:checked").length > 0;
      panelActions.classList.toggle("hidden", !anyCheckedNow);
    }

    // Attach listeners on searchInput and sortSelect to re-render when changed
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        renderList(entries);
      });
    }
    if (sortSelect) {
      sortSelect.addEventListener("change", () => {
        renderList(entries);
      });
    }

    // Listen to Firebase changes
    onValue(ref(db, "authorizedUIDs"), (snap) => {
      if (!snap.exists()) {
        entries = [];
        uidList.innerHTML = "<p>No reserved UIDs.</p>";
        panelActions.classList.add("hidden");
        return;
      }
      const data = snap.val();
      // Build entries array: include timestamp if present
      entries = Object.entries(data).map(([uid, info]) => ({
        uid,
        name: info.name || "",
        plate: info.plate || "",
        timestamp: info.timestamp || 0
      }));
      // Render with current search & sort
      renderList(entries);
    });

    // Bulk delete
    bulkBtn.addEventListener("click", async () => {
      const checkedBoxes = document.querySelectorAll(".uid-checkbox:checked");
      if (!checkedBoxes.length) return;
      if (!confirm(`Delete ${checkedBoxes.length} selected UID(s)?`)) return;

      try {
        const deletes = Array.from(checkedBoxes).map(cb => {
          const uid = cb.value;
          return remove(ref(db, `authorizedUIDs/${uid}`));
        });
        await Promise.all(deletes);

        showModal(`${checkedBoxes.length} UID(s) removed.`, "success", {
          buttonLabel: "Okay",
          autoClose: true,
          autoCloseDelay: 1500
        });
        panelActions.classList.add("hidden");
        // onValue listener will re-render entries
      } catch (err) {
        console.error("Bulk delete failed:", err);
        showModal("Failed to delete selected UID(s).", "error");
      }
    });

    // Utility: Get all selectable (non-disabled) checkboxes
    const getSelectableCheckboxes = () =>
      Array.from(document.querySelectorAll(".uid-checkbox:not(:disabled)"));

    // Deselect All
    deselectAllBtn.addEventListener("click", () => {
      getSelectableCheckboxes().forEach(cb => cb.checked = false);
      panelActions.classList.add("hidden");
    });

    // Select All
    selectAllBtn.addEventListener("click", () => {
      const checkboxes = getSelectableCheckboxes();
      if (!checkboxes.length) return;

      checkboxes.forEach(cb => cb.checked = true);
      panelActions.classList.remove("hidden");
    });

  } catch (err) {
    console.warn("setupRemoveUIDs failed:", err.message);
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
  } catch (err) {
    console.error('[Init] Initialization error:', err);
  }
})();