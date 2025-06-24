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

// Mode toggle
const modeToggleBtn = $('modeToggle');
const mainContainer = $('mainContainer');
const adminContainer = $('adminContainer');
if (modeToggleBtn && mainContainer && adminContainer) {
  modeToggleBtn.addEventListener('click', () => {
    const isAdminMode = !adminContainer.classList.contains('hidden');
    console.log(`Mode toggled. Admin mode: ${!isAdminMode}`);

    if (isAdminMode) {
      adminContainer.classList.add('hidden');
      mainContainer.classList.remove('hidden');
      modeToggleBtn.textContent = 'Admin Mode';
    } else {
      adminContainer.classList.remove('hidden');
      mainContainer.classList.add('hidden');
      modeToggleBtn.textContent = 'User Mode';
    }
  });
}

// Controls
const reserveBtn = $('reserve');
const cancelScanBtn = $('cancelScan');
const uidList = $('uidList');
const bulkBtn = $('bulkDeleteBtn');
const closeRemoveModalBtn = $('closeRemoveModalBtn');
const logoutBtn = $('logout');
const controlPanel = $('controlPanel');
const searchInput = $('searchInput');
const sortSelect = $('sortSelect');

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
  const nameEl = $('inputName');
  const plateEl = $('inputPlate');
  if (nameEl) nameEl.value = '';
  if (plateEl) plateEl.value = '';
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

  reserveBtn.addEventListener('click', () => {
    console.log("[Reserve] Opening addModal");
    showModal('addModal');
  });

  const confirmAddBtn = $('confirmAdd');
  const cancelAddBtn = $('cancelAdd');

  confirmAddBtn?.addEventListener('click', async () => {
    if (!auth.currentUser) {
      console.warn('[Reserve] No authenticated user');
      return;
    }

    const name = $('inputName')?.value.trim();
    const plate = $('inputPlate')?.value.trim();
    console.log(`[Reserve] Input: name=${name}, plate=${plate}`);

    if (!name || !plate) {
      showModal('Please fill all fields.', 'error');
      return;
    }

    closeModal('addModal');
    showModal('Please scan a tag to reserve.', 'info');

    try {
      console.log("[Reserve] Enabling scan mode...");
      await set(ref(db, 'scanMode'), true);
      console.log("[Reserve] Scan mode enabled");
    } catch (err) {
      console.error('[Reserve] Failed to start scan mode:', err);
      showModal('Failed to start scan mode.', 'error');
      return;
    }

    isScanning = true;
    const scannedRef = ref(db, 'lastScannedUID');

    console.log("[Reserve] Listening to lastScannedUID...");
    stopScan = onValue(scannedRef, async snap => {
      const uid = snap.val();
      console.log("[Reserve] onValue received UID:", uid);
      if (isScanning && uid) {
        try {
          const snapshot = await get(ref(db, 'authorizedUIDs'));
          const existing = snapshot.exists() ? snapshot.val() : {};

          let nameExists = false;
          let plateExists = false;

          for (const [eUID, data] of Object.entries(existing)) {
            if (eUID === uid) continue;
            if (data.name === name) nameExists = true;
            if (data.plate === plate) plateExists = true;
          }

          if (existing[uid]) {
            showModal(`UID ${uid} is already registered.`, 'error', { buttonLabel: 'Okay', autoClose: true, autoCloseDelay: 2500 });
            return;
          }
          if (nameExists || plateExists) {
            showModal('Name or plate already registered under a different UID.', 'error', { buttonLabel: 'Okay', autoClose: true, autoCloseDelay: 2500 });
            return;
          }

          await set(ref(db, `authorizedUIDs/${uid}`), { allowed: true, name, plate });
          console.log(`[Reserve] UID ${uid} written to DB`);
          showModal(`UID ${uid} authorized`, 'success');
        } catch (err) {
          console.error('[Reserve] Failed to write authorized UID:', err);
          showModal('Failed to authorize UID.', 'error');
        }
        setTimeout(async () => {
          closeModal();
          await clearScan();
          resetInputFields();
        }, 2000);
      }
    });
  });

  cancelAddBtn?.addEventListener('click', () => {
    console.log("[Reserve] Cancel clicked");
    closeModal('addModal');
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

// Helper: wait for elements
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);
    const observer = new MutationObserver(() => {
      const found = document.querySelector(selector);
      if (found) {
        observer.disconnect();
        resolve(found);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found`));
    }, timeout);
  });
}

async function setupRemoveUIDs() {
  console.log("setupRemoveUIDs: initializing...");
  try {
    await waitForElement('#uidList');
    await waitForElement('#bulkDeleteBtn');
    await waitForElement('#panelActions');

    // Listen to DB
    onValue(ref(db, 'authorizedUIDs'), snap => {
      if (!snap.exists()) {
        uidList.innerHTML = '<p>No reserved UIDs.</p>';
        return;
      }

      // Build array
      const entries = Object.entries(snap.val()).map(([uid, info]) => ({
        uid,
        name: info.name || 'Unnamed',
        plate: info.plate || 'No Plate'
      }));

      const render = data => {
        uidList.innerHTML = '';
        data.forEach(({ uid, name, plate }) => {
          const card = document.createElement('div');
          card.className = 'uid-card';

          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.className = 'uid-checkbox';
          checkbox.value = uid;
          checkbox.addEventListener('change', () => {
            const anyChecked = document.querySelectorAll('.uid-checkbox:checked').length > 0;
            $('panelActions').classList.toggle('hidden', !anyChecked);
          });

          const infoWrap = document.createElement('div');
          infoWrap.className = 'uid-info';
          infoWrap.innerHTML = `<div class='uid-field'><strong>${uid}</strong></div>` +
                               `<div class='uid-field'>${name}</div>` +
                               `<div class='uid-field'>${plate}</div>`;

          const delBtn = document.createElement('button');
          delBtn.className = 'delete-btn';
          delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
          delBtn.addEventListener('click', async () => {
            try {
              await remove(ref(db, `authorizedUIDs/${uid}`));
              showModal(`UID ${uid} removed`, 'success');
            } catch (err) {
              console.error('Failed to remove UID', err);
              showModal('Failed to remove UID.', 'error');
            }
          });

          card.append(checkbox, infoWrap, delBtn);
          uidList.appendChild(card);
        });
      };

      // Filter & sort
      const updateList = () => {
        const txt = (searchInput?.value || '').toLowerCase();
        const sortBy = sortSelect?.value || 'uid';

        let filtered = entries.filter(e =>
          e.uid.toLowerCase().includes(txt) ||
          e.name.toLowerCase().includes(txt) ||
          e.plate.toLowerCase().includes(txt)
        );

        filtered.sort((a, b) => a[sortBy].localeCompare(b[sortBy], undefined, { sensitivity: 'base' }));
        render(filtered);
      };

      searchInput?.addEventListener('input', updateList);
      sortSelect?.addEventListener('change', updateList);
      updateList();

      // Panel Action Buttons
      const bulkDeleteBtn = $('bulkDeleteBtn');
      const selectAllBtn = $('selectAllBtn');
      const deselectAllBtn = $('deselectAllBtn');

      bulkDeleteBtn?.addEventListener('click', async () => {
        const checked = Array.from(document.querySelectorAll('.uid-checkbox:checked'));
        if (checked.length === 0) return;

        if (!confirm(`Are you sure you want to delete ${checked.length} selected UID(s)?`)) return;

        try {
          for (const box of checked) {
            const uid = box.value;
            await remove(ref(db, `authorizedUIDs/${uid}`));
          }
          showModal(`${checked.length} UID(s) deleted`, 'success');
        } catch (err) {
          console.error('Bulk delete failed:', err);
          showModal('Bulk delete failed.', 'error');
        }
      });

      selectAllBtn?.addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('.uid-checkbox');
        checkboxes.forEach(cb => cb.checked = true);
        $('panelActions')?.classList.remove('hidden');
      });

      deselectAllBtn?.addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('.uid-checkbox');
        checkboxes.forEach(cb => cb.checked = false);
        $('panelActions')?.classList.add('hidden');
      });
    });

  } catch (err) {
    console.warn("setupRemoveUIDs failed:", err.message);
  }
}

function authReady() {
  return new Promise(resolve => {
    const unsub = onAuthStateChanged(auth, user => {
      console.log("[authReady] User:", user?.email || 'None');
      controlPanel?.classList.toggle('hidden', !user);
      setupLogout(); setupReserve(); setupCancelScan(); setupRemoveUIDs();
      unsub(); resolve(user);
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
