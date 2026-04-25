let timerState = {
  timeLeft: 25 * 60,
  isRunning: false,
  mode: 'focus',
  targetTime: 0
};

const FOCUS_TIME = 25 * 60;
const BREAK_TIME = 5 * 60;

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ timerState });
});

// Muat state saat startup
chrome.storage.local.get(['timerState'], (res) => {
  if (res.timerState) {
    timerState = res.timerState;
  }
});

// Broadcast state ke semua tab yang terbuka
function broadcastState() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { type: 'STATE_UPDATE', state: timerState }).catch(() => {});
    });
  });
}

function handleTimerEnd() {
  timerState.isRunning = false;
  
  // Ganti mode
  timerState.mode = timerState.mode === 'focus' ? 'break' : 'focus';
  timerState.timeLeft = timerState.mode === 'focus' ? FOCUS_TIME : BREAK_TIME;
  timerState.targetTime = 0;
  
  // Notifikasi
  chrome.notifications.create({
    type: 'basic',
    iconUrl: timerState.mode === 'break' ? 'assets/break.png' : 'assets/focus.png',
    title: timerState.mode === 'break' ? 'Waktunya Istirahat!' : 'Ayo Fokus Lagi!',
    message: timerState.mode === 'break' ? 'Kerja bagus! Waktunya main sama Fibi.' : 'Kumpulkan energy spectro!'
  });
  
  chrome.storage.local.set({ timerState });
  broadcastState();
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pomodoroEnd') {
    handleTimerEnd();
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'START') {
    timerState.isRunning = true;
    timerState.targetTime = Date.now() + (timerState.timeLeft * 1000);
    chrome.alarms.create('pomodoroEnd', { when: timerState.targetTime });
    chrome.storage.local.set({ timerState });
    broadcastState();
  } else if (request.type === 'PAUSE') {
    timerState.isRunning = false;
    if (timerState.targetTime > 0) {
      timerState.timeLeft = Math.max(0, Math.round((timerState.targetTime - Date.now()) / 1000));
    }
    chrome.alarms.clear('pomodoroEnd');
    chrome.storage.local.set({ timerState });
    broadcastState();
  } else if (request.type === 'RESET') {
    timerState.isRunning = false;
    timerState.mode = 'focus';
    timerState.timeLeft = FOCUS_TIME;
    timerState.targetTime = 0;
    chrome.alarms.clear('pomodoroEnd');
    chrome.storage.local.set({ timerState });
    broadcastState();
  } else if (request.type === 'GET_STATE') {
    // Sinkronkan sisa waktu sebelum dikirim
    if (timerState.isRunning && timerState.targetTime > 0) {
      timerState.timeLeft = Math.max(0, Math.round((timerState.targetTime - Date.now()) / 1000));
    }
    sendResponse(timerState);
  }
  return true; 
});
