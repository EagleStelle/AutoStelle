// ui.js
export function showModal(arg, color = "success", options = {}) {
  let modal;
  const colorMap = {
    success: "var(--peach-fuzz)",
    error: "var(--blush-mist)",
    info: "var(--lavender-haze)",
    default: "var(--mauve-mist)",
  };
  const colorKeys = Object.keys(colorMap);
  const isTextMessage = typeof arg === "string" && !document.getElementById(arg);

  if (isTextMessage) {
    modal = document.getElementById("modal");
    const modalMessage = document.getElementById("modalMessage");
    const modalBtn = document.getElementById("modalButton"); // Add this button in your HTML

    if (modalMessage) {
      modalMessage.textContent = arg;
      modalMessage.style.color = colorMap[color] || colorMap.default;
    }

    if (modalBtn) {
      modalBtn.textContent = options.buttonLabel || "Cancel";
      modalBtn.onclick = () => closeModal();
    }

    if (options.autoClose) {
      setTimeout(() => {
        closeModal();
      }, options.autoCloseDelay || 2000);
    }
  } else {
    modal = typeof arg === "string" ? document.getElementById(arg) : arg;
  }

  if (!modal) return;
  modal.classList.remove("hidden");
  modal.classList.add("show");
}

export function closeModal(modalId = null) {
  const modals = modalId
    ? [document.getElementById(modalId)]
    : document.querySelectorAll(".modal.show");

  modals.forEach((modal) => {
    if (modal) {
      modal.classList.remove("show");
      modal.classList.add("hidden");
    }
  });
}
  
export function initPasswordToggle(inputId) {
    const passwordInput = document.getElementById(inputId);
    if (!passwordInput) return;
  
    const wrapper = document.createElement("div");
    wrapper.style.position = "relative";
    passwordInput.parentNode.insertBefore(wrapper, passwordInput);
    wrapper.appendChild(passwordInput);
  
    const toggleBtn = document.createElement("span");
    Object.assign(toggleBtn.style, {
      position: "absolute",
      right: "10px",
      top: "50%",
      transform: "translateY(-50%)",
      cursor: "pointer",
      userSelect: "none",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: "20px",
      width: "20px"
    });
    toggleBtn.innerHTML = getModernEyeSVG(false);
    wrapper.appendChild(toggleBtn);
  
    toggleBtn.addEventListener("click", () => {
      const isPassword = passwordInput.type === "password";
      passwordInput.type = isPassword ? "text" : "password";
      toggleBtn.innerHTML = getModernEyeSVG(isPassword);
    });
  
    function getModernEyeSVG(visible) {
      return visible
        ? `<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a20.34 20.34 0 0 1 5.06-6.06"/>
            <path d="M1 1l22 22"/>
            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
            <path d="M21.06 16.95A20.32 20.32 0 0 0 23 12s-4-7-11-7a10.94 10.94 0 0 0-4.06.94"/>
          </svg>`;
    }
}