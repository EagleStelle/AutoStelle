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

// Grab elements once
const modeToggleBtn = document.getElementById("modeToggle");
const mainContainer = document.getElementById("mainContainer");
const adminContainer = document.getElementById("adminContainer");

if (modeToggleBtn && mainContainer && adminContainer) {
  modeToggleBtn.addEventListener("click", () => {
    const isAdminMode = !adminContainer.classList.contains("hidden");

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

// Utility: clear scanning state in database and stop listener
let isScanning = false;
let stopScan = null;
async function clearScan() {
  isScanning = false;
  try {
    await Promise.all([
      set(ref(db, 'scanMode'), false),
      set(ref(db, 'lastScannedUID'), "")
    ]);
  } catch (err) {
    console.error('clearScan: failed to write DB flags', err);
  }
  if (typeof stopScan === 'function') {
    stopScan();
    stopScan = null;
  }
}

// Reset input fields for reservation
function resetInputFields() {
  const nameEl = document.getElementById("inputName");
  const plateEl = document.getElementById("inputPlate");
  if (nameEl) nameEl.value = "";
  if (plateEl) plateEl.value = "";
}

// Logout setup
function setupLogout() {
  if (!logoutBtn) return;
  logoutBtn.addEventListener('click', () => {
    signOut(auth)
      .then(() => {
        window.location.href = 'index.html';
      })
      .catch(err => console.error('Logout failed:', err));
  });
}

// Reservation (authorize new UID)
function setupReserve() {
  if (!reserveBtn) return;

  reserveBtn.addEventListener("click", () => {
    // show the modal to input name & plate
    showModal("addModal"); // assuming showModal takes the modal's ID
  });

  // rename to avoid shadowing
  const confirmAddBtn = document.getElementById("confirmAdd");
  const cancelAddBtn = document.getElementById("cancelAdd");

  // Confirm reservation: ask user to scan tag
  confirmAddBtn?.addEventListener("click", async () => {
    if (!auth.currentUser) {
      console.warn('User not authenticated');
      return;
    }

    const nameInput = document.getElementById("inputName");
    const plateInput = document.getElementById("inputPlate");
    const name = nameInput?.value.trim();
    const plate = plateInput?.value.trim();

    if (!name || !plate) {
      showModal("Please fill all fields.", "error");
      return;
    }

    closeModal("addModal");
    showModal("Please scan a tag to reserve.", "info");

    try {
      await set(ref(db, "scanMode"), true);
    } catch (err) {
      console.error('Failed to start scan mode', err);
      showModal("Failed to start scan mode.", "error");
      return;
    }

    isScanning = true;
    const scannedRef = ref(db, "lastScannedUID");

    // onValue returns an unsubscribe function
    stopScan = onValue(scannedRef, async snap => {
      const uid = snap.val();
      if (isScanning && uid) {
        try {
          await set(ref(db, `authorizedUIDs/${uid}`), {
            allowed: true,   // ✅ This aligns with ESP32 expectations
            name,
            plate
          });
          showModal(`UID ${uid} authorized`, "success");
        } catch (err) {
          console.error('Error writing authorizedUIDs', err);
          showModal("Failed to authorize UID.", "error");
        }
        // Delay then cleanup
        setTimeout(async () => {
          closeModal(); 
          await clearScan();
          resetInputFields();
        }, 2000);
      }
    });
  });

  cancelAddBtn?.addEventListener("click", () => {
    closeModal("addModal");
    resetInputFields();
  });
}

// Cancel scanning early
function setupCancelScan() {
  if (!cancelScanBtn) return;
  cancelScanBtn.addEventListener('click', async () => {
    closeModal(); 
    await clearScan();
    resetInputFields();
  });
}

// Remove UIDs
function setupRemoveUIDs() {
  if (!uidList || !bulkBtn || !closeRemoveModalBtn) return;

  const panelActions = document.getElementById("panelActions");

  uidList.innerHTML = '<p>Loading...</p>';

  get(ref(db, 'authorizedUIDs'))
    .then((snap) => {
      const uids = snap.exists() ? snap.val() : {};

      if (!uids || !Object.keys(uids).length) {
        uidList.innerHTML = '<p>No reserved UIDs.</p>';
        return;
      }

      uidList.innerHTML = '';
      for (const [uid, info] of Object.entries(uids)) {
        const name = info.name || 'Unnamed';
        const plate = info.plate || 'No Plate';

        const card = document.createElement('div');
        card.className = 'uid-card';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'uid-checkbox';
        checkbox.value = uid;

        checkbox.addEventListener('change', () => {
          const anyChecked = document.querySelectorAll('.uid-checkbox:checked').length > 0;
          panelActions.classList.toggle('hidden', !anyChecked);
        });

        const infoWrapper = document.createElement('div');
        infoWrapper.className = 'uid-info';

        const uidField = document.createElement('div');
        uidField.className = 'uid-field';
        uidField.innerHTML = `<strong>${uid}</strong>`;

        const nameField = document.createElement('div');
        nameField.className = 'uid-field';
        nameField.textContent = name;

        const plateField = document.createElement('div');
        plateField.className = 'uid-field';
        plateField.textContent = plate;

        infoWrapper.append(uidField, nameField, plateField);

        const delBtn = document.createElement('button');
        delBtn.className = 'delete-btn';
        delBtn.dataset.uid = uid;
        delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';

        delBtn.addEventListener('click', async () => {
          try {
            await remove(ref(db, `authorizedUIDs/${uid}`));
            card.remove();
            showModal(`UID ${uid} removed`, "success");
          } catch (err) {
            console.error('Failed to remove UID', err);
            showModal("Failed to remove UID.", "error");
          }
        });

        card.append(checkbox, infoWrapper, delBtn);
        uidList.appendChild(card);
      }
    })
    .catch((err) => {
      console.error("Failed to load UIDs:", err);
      uidList.innerHTML = '<p>Error fetching UIDs.</p>';
    });

  bulkBtn.addEventListener('click', async () => {
    const boxes = document.querySelectorAll('.uid-checkbox:checked');
    if (!boxes.length) {
      showModal("No UIDs selected.", "info");
      return;
    }

    for (const box of boxes) {
      const uid = box.value;
      try {
        await remove(ref(db, `authorizedUIDs/${uid}`));
        box.closest('.uid-card')?.remove();
      } catch (err) {
        console.error(`Failed to remove UID ${uid}`, err);
      }
    }

    panelActions.classList.add('hidden');
    showModal("Selected UIDs removed.", "success");
  });

  closeRemoveModalBtn.addEventListener('click', () => {
    document.querySelectorAll('.uid-checkbox').forEach(cb => cb.checked = false);
    panelActions.classList.add('hidden');
  });
}

// Wait for auth state, then initialize UI
function authReady() {
  return new Promise(resolve => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      if (user) {
        controlPanel?.classList.remove('hidden');
      } else {
        controlPanel?.classList.add('hidden');
      }
      // Set up handlers once user state known
      setupLogout();
      setupReserve();
      setupCancelScan();
      setupRemoveUIDs();

      unsubscribe(); // stop listening further in this promise
      resolve(user);
    });
  });
}

// On load
(async () => {
  try {
    await authReady();
    // Optionally you can re-run setups if needed, but authReady already did
    setupLogout();
    setupReserve();
    setupCancelScan();
    setupRemoveUIDs();
  } catch (err) {
    console.error('Initialization error:', err);
  }
})();
