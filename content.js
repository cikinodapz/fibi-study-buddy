let appContainer = null;
// Menggunakan gambar phoebe yang kamu lampirkan
let imgFocusUrl = chrome.runtime.getURL('assets/focus.png');
let imgBreakUrl = chrome.runtime.getURL('assets/break.png');

function injectUI() {
  if (document.getElementById('fibi-pomodoro-root')) return;

  appContainer = document.createElement('div');
  appContainer.id = 'fibi-pomodoro-root';
  appContainer.innerHTML = `
    <div class="fibi-widget">
      <div class="fibi-drag-handle">≡ Drag ≡</div>
      <div class="fibi-char">
        <!-- Jika gambar gagal dimuat, akan menampilkan alt text -->
        <img src="${imgFocusUrl}" id="fibi-img" alt="Phoebe">
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

  // Setup Controls
  document.getElementById('fibi-start').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'START' });
  });
  document.getElementById('fibi-pause').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'PAUSE' });
  });
  document.getElementById('fibi-reset').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'RESET' });
  });

  // Get initial state
  chrome.runtime.sendMessage({ type: 'GET_STATE' }, updateUI);
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
    if(imgEl && imgEl.src !== imgBreakUrl) imgEl.src = imgBreakUrl;
  } else {
    if(widget) widget.classList.remove('fibi-break-mode');
    if(imgEl && imgEl.src !== imgFocusUrl) imgEl.src = imgFocusUrl;
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
