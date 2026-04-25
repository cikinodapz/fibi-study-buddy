let appContainer = null;
// Menggunakan gambar phoebe yang kamu lampirkan
let imgFocusUrl1 = chrome.runtime.getURL('assets/focus.png');
let imgFocusUrl2 = chrome.runtime.getURL('assets/focus2.png');
let imgBreakUrl1 = chrome.runtime.getURL('assets/break.png');
let imgBreakUrl2 = chrome.runtime.getURL('assets/break2.png');

let animToggleState = false;
let animInterval = null;
let currentModeAnim = null;

function startAnimation(mode) {
  if (currentModeAnim === mode && animInterval) return;
  
  stopAnimation();

  currentModeAnim = mode;
  animToggleState = true;
  
  const imgEl = document.getElementById('fibi-img');
  if (imgEl) {
    imgEl.src = mode === 'focus' ? imgFocusUrl1 : imgBreakUrl1;
  }

  animInterval = setInterval(() => {
    const el = document.getElementById('fibi-img');
    if (el) {
      animToggleState = !animToggleState;
      if (mode === 'focus') {
        el.src = animToggleState ? imgFocusUrl2 : imgFocusUrl1;
      } else {
        el.src = animToggleState ? imgBreakUrl2 : imgBreakUrl1;
      }
    }
  }, 400); // Ganti frame tiap 400ms
}

function stopAnimation() {
  if (animInterval) {
    clearInterval(animInterval);
    animInterval = null;
    currentModeAnim = null;
    animToggleState = false;
  }
}

function injectUI() {
  if (document.getElementById('fibi-pomodoro-root')) return;

  appContainer = document.createElement('div');
  appContainer.id = 'fibi-pomodoro-root';
  appContainer.innerHTML = `
    <div class="fibi-widget">
      <div class="fibi-drag-handle">≡ Drag ≡</div>
      <div class="fibi-char">
        <!-- Jika gambar gagal dimuat, akan menampilkan alt text -->
        <img src="${imgFocusUrl1}" id="fibi-img" alt="Phoebe">
      </div>
      <div class="fibi-timer">
        <span id="fibi-time">25:00</span>
      </div>
      <div class="fibi-controls">
        <button id="fibi-start" title="Mulai">▶</button>
        <button id="fibi-pause" style="display:none;" title="Jeda">⏸</button>
        <button id="fibi-reset" title="Reset">↻</button>
      </div>
    </div>
  `;
  document.body.appendChild(appContainer);

  // Setup Dragging (Agar widget bisa digeser-geser di layar)
  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  let xOffset = 0;
  let yOffset = 0;

  const dragHandle = appContainer.querySelector('.fibi-drag-handle');
  const widget = appContainer.querySelector('.fibi-widget');

  dragHandle.addEventListener("mousedown", dragStart);
  document.addEventListener("mouseup", dragEnd);
  document.addEventListener("mousemove", drag);

  function dragStart(e) {
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;
    if (e.target === dragHandle) {
      isDragging = true;
    }
  }

  function dragEnd(e) {
    initialX = currentX;
    initialY = currentY;
    isDragging = false;
  }

  function drag(e) {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      xOffset = currentX;
      yOffset = currentY;
      widget.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    }
  }

  // Helper untuk mengirim pesan dengan aman (menghindari error saat ekstensi di-reload)
  function safeSendMessage(message, callback) {
    try {
      if (chrome.runtime && chrome.runtime.sendMessage) {
        if (callback) {
          chrome.runtime.sendMessage(message, callback);
        } else {
          chrome.runtime.sendMessage(message);
        }
      } else {
        throw new Error("Context invalid");
      }
    } catch (err) {
      console.warn("Fibi Extension: Context hilang (biasanya karena ekstensi baru di-update). Refresh halaman ya!");
      alert("Fibi baru saja di-update! Silakan refresh (F5) halaman ini agar Fibi bisa nyambung lagi.");
    }
  }

  // Setup Controls
  document.getElementById('fibi-start').addEventListener('click', () => {
    safeSendMessage({ type: 'START' });
  });
  document.getElementById('fibi-pause').addEventListener('click', () => {
    safeSendMessage({ type: 'PAUSE' });
  });
  document.getElementById('fibi-reset').addEventListener('click', () => {
    safeSendMessage({ type: 'RESET' });
  });

  // Get initial state
  safeSendMessage({ type: 'GET_STATE' }, updateUI);
}

function updateUI(state) {
  if (!state) return;
  const minutes = Math.floor(state.timeLeft / 60);
  const seconds = state.timeLeft % 60;
  const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  
  const timeEl = document.getElementById('fibi-time');
  if(timeEl) timeEl.textContent = timeStr;

  const startBtn = document.getElementById('fibi-start');
  const pauseBtn = document.getElementById('fibi-pause');
  const widget = document.querySelector('.fibi-widget');
  const imgEl = document.getElementById('fibi-img');

  if (state.isRunning) {
    if(startBtn) startBtn.style.display = 'none';
    if(pauseBtn) pauseBtn.style.display = 'inline-block';
    if(imgEl) imgEl.classList.add('fibi-bouncing');
  } else {
    if(startBtn) startBtn.style.display = 'inline-block';
    if(pauseBtn) pauseBtn.style.display = 'none';
    if(imgEl) imgEl.classList.remove('fibi-bouncing');
  }

  if (state.mode === 'break') {
    if(widget) widget.classList.add('fibi-break-mode');
    startAnimation('break');
  } else {
    if(widget) widget.classList.remove('fibi-break-mode');
    startAnimation('focus');
  }
}

// Listen for ticks dari background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'TICK') {
    updateUI(request.state);
  }
});

// Run injection
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectUI);
} else {
  injectUI();
}
