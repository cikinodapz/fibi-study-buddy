let timerState = {
  timeLeft: 25 * 60,
  isRunning: false,
  mode: 'focus',
  targetTime: 0
};

const FOCUS_TIME = 25 * 60;
const BREAK_TIME = 5 * 60;
let interval = null;

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ timerState });
});

// Muat state saat startup
chrome.storage.local.get(['timerState'], (res) => {
  if (res.timerState) {
    timerState = res.timerState;
    if (timerState.isRunning) {
      startInternalTimer();
    }
  }
});

// Broadcast timer ke semua tab yang terbuka
function broadcastState() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { type: 'TICK', state: timerState }).catch(() => {});
    });
  });
}

function startInternalTimer() {
  if (interval) clearInterval(interval);
  timerState.targetTime = Date.now() + (timerState.timeLeft * 1000);
  
  interval = setInterval(() => {
    let now = Date.now();
    timerState.timeLeft = Math.max(0, Math.round((timerState.targetTime - now) / 1000));
    
    if (timerState.timeLeft <= 0) {
      clearInterval(interval);
      timerState.isRunning = false;
      
      // Ganti mode
      timerState.mode = timerState.mode === 'focus' ? 'break' : 'focus';
      timerState.timeLeft = timerState.mode === 'focus' ? FOCUS_TIME : BREAK_TIME;
      
      // Notifikasi
      chrome.notifications.create({
        type: 'basic',
        iconUrl: timerState.mode === 'break' ? 'assets/break.png' : 'assets/focus.png',
        title: timerState.mode === 'break' ? 'Waktunya Istirahat!' : 'Ayo Fokus Lagi!',
        message: timerState.mode === 'break' ? 'Kerja bagus! Waktunya main sama Fibi.' : 'Kumpulkan energy spectro!'
      });
      
      chrome.storage.local.set({ timerState });
      broadcastState();
    } else {
      broadcastState();
    }
  }, 1000);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'START') {
    timerState.isRunning = true;
    chrome.storage.local.set({ timerState });
    startInternalTimer();
    broadcastState();
  } else if (request.type === 'PAUSE') {
    timerState.isRunning = false;
    if (interval) clearInterval(interval);
    chrome.storage.local.set({ timerState });
    broadcastState();
  } else if (request.type === 'RESET') {
    timerState.isRunning = false;
    timerState.mode = 'focus';
    timerState.timeLeft = FOCUS_TIME;
    if (interval) clearInterval(interval);
    chrome.storage.local.set({ timerState });
    broadcastState();
  } else if (request.type === 'GET_STATE') {
    sendResponse(timerState);
  }
  return true; // Keep message channel open for async response
});
