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
const removeBtn = $('remove');
const cancelScanBtn = $('cancelScan');
const addModal = $('addModal');
const uidList = $('uidList');
const bulkBtn = $('bulkDeleteBtn');
const closeRemoveModalBtn = $('closeRemoveModalBtn');
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
      showModal("Please fill all fields.", "error");
      return;
    }

    closeModal("addModal");
    showModal("Please scan a tag to reserve.", "info");

    try {
      console.log("[Reserve] Enabling scan mode...");
      await set(ref(db, "scanMode"), true);
      console.log("[Reserve] Scan mode enabled");
    } catch (err) {
      console.error('[Reserve] Failed to start scan mode:', err);
      showModal("Failed to start scan mode.", "error");
      return;
    }

    isScanning = true;
    const scannedRef = ref(db, "lastScannedUID");

    console.log("[Reserve] Listening to lastScannedUID...");
    stopScan = onValue(scannedRef, async snap => {
      const uid = snap.val();
      console.log("[Reserve] onValue received UID:", uid);
      if (isScanning && uid) {
        try {
        const authorizedRef = ref(db, "authorizedUIDs");
        const snapshot = await get(authorizedRef);
        const existingUIDs = snapshot.exists() ? snapshot.val() : {};

        let nameExists = false;
        let plateExists = false;

        for (const [existingUID, data] of Object.entries(existingUIDs)) {
          if (existingUID === uid) continue; // Skip same UID
          if (data.name === name) nameExists = true;
          if (data.plate === plate) plateExists = true;
        }

        if (existingUIDs[uid]) {
          showModal(`UID ${uid} is already registered.`, "error", {
            buttonLabel: "Okay",
            autoClose: true,
            autoCloseDelay: 2500
          });
          return;
        }

        if (nameExists || plateExists) {
          showModal(`Name or plate already registered under a different UID.`, "error", {
            buttonLabel: "Okay",
            autoClose: true,
            autoCloseDelay: 2500
          });
          return;
        }

        // Safe to save new UID
        await set(ref(db, `authorizedUIDs/${uid}`), {
          allowed: true,
          name,
          plate
        });
          console.log(`[Reserve] UID ${uid} written to DB`);
          showModal(`UID ${uid} authorized`, "success");
        } catch (err) {
          console.error('[Reserve] Failed to write authorized UID:', err);
          showModal("Failed to authorize UID.", "error");
        }
        setTimeout(async () => {
          closeModal(); 
          await clearScan();
          resetInputFields();
        }, 2000);
      }
    });
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

// Helper: Waits until a DOM element exists
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
    const uidList = await waitForElement("#uidList");
    const bulkBtn = await waitForElement("#bulkDeleteBtn");
    const closeBtn = await waitForElement("#closeRemovePanelBtn");
    const panelActions = document.getElementById("panelActions");

    uidList.innerHTML = "<p>Loading...</p>";
    console.log("Fetching authorizedUIDs from database...");

    onValue(ref(db, "authorizedUIDs"), (snap) => {
      if (!snap.exists()) {
        uidList.innerHTML = "<p>No reserved UIDs.</p>";
        return;
      }

      const uids = snap.val();
      uidList.innerHTML = "";

      for (const [uid, info] of Object.entries(uids)) {
        const name = info.name || "Unnamed";
        const plate = info.plate || "No Plate";

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

        const uidField = document.createElement("div");
        uidField.className = "uid-field";
        uidField.innerHTML = `<strong>${uid}</strong>`;

        const nameField = document.createElement("div");
        nameField.className = "uid-field";
        nameField.textContent = name;

        const plateField = document.createElement("div");
        plateField.className = "uid-field";
        plateField.textContent = plate;

        infoWrapper.append(uidField, nameField, plateField);

        const delBtn = document.createElement("button");
        delBtn.className = "delete-btn";
        delBtn.dataset.uid = uid;
        delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';

        delBtn.addEventListener("click", async () => {
          try {
            await remove(ref(db, `authorizedUIDs/${uid}`));
            showModal(`UID ${uid} removed`, "success");
          } catch (err) {
            console.error("Failed to remove UID", err);
            showModal("Failed to remove UID.", "error");
          }
        });

        card.append(checkbox, infoWrapper, delBtn);
        uidList.appendChild(card);
      }
    });

    console.log("Firebase response received");

    if (!snap.exists()) {
      console.warn("No authorizedUIDs found in database");
      uidList.innerHTML = "<p>No reserved UIDs.</p>";
      return;
    }

    const uids = snap.val();
    console.log("UIDs fetched:", uids);

    uidList.innerHTML = "";
    for (const [uid, info] of Object.entries(uids)) {
      const name = info.name || "Unnamed";
      const plate = info.plate || "No Plate";

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

      const uidField = document.createElement("div");
      uidField.className = "uid-field";
      uidField.innerHTML = `<strong>${uid}</strong>`;

      const nameField = document.createElement("div");
      nameField.className = "uid-field";
      nameField.textContent = name;

      const plateField = document.createElement("div");
      plateField.className = "uid-field";
      plateField.textContent = plate;

      infoWrapper.append(uidField, nameField, plateField);

      const delBtn = document.createElement("button");
      delBtn.className = "delete-btn";
      delBtn.dataset.uid = uid;
      delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';

      delBtn.addEventListener("click", async () => {
        try {
          await remove(ref(db, `authorizedUIDs/${uid}`));
          card.remove();
          showModal(`UID ${uid} removed`, "success");
        } catch (err) {
          console.error("Failed to remove UID", err);
          showModal("Failed to remove UID.", "error");
        }
      });

      card.append(checkbox, infoWrapper, delBtn);
      uidList.appendChild(card);
    }
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
