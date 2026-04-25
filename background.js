let timerState = {
  timeLeft: 25 * 60,
  isRunning: false,
  mode: 'focus',
  targetTime: 0
};

let fibiSettings = {
  focusMinutes: 25,
  breakMinutes: 5
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ timerState, fibiSettings });
});

// Muat state dan settings saat startup
chrome.storage.local.get(['timerState', 'fibiSettings'], (res) => {
  if (res.timerState) {
    timerState = res.timerState;
  }
  if (res.fibiSettings) {
    fibiSettings = res.fibiSettings;
  }
});

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
  timerState.timeLeft = timerState.mode === 'focus' ? fibiSettings.focusMinutes * 60 : fibiSettings.breakMinutes * 60;
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
    timerState.timeLeft = fibiSettings.focusMinutes * 60;
    timerState.targetTime = 0;
    chrome.alarms.clear('pomodoroEnd');
    chrome.storage.local.set({ timerState });
    broadcastState();
  } else if (request.type === 'GET_STATE') {
    // Sinkronkan sisa waktu sebelum dikirim
    if (timerState.isRunning && timerState.targetTime > 0) {
      timerState.timeLeft = Math.max(0, Math.round((timerState.targetTime - Date.now()) / 1000));
    }
    sendResponse({ timerState, fibiSettings });
  } else if (request.type === 'UPDATE_SETTINGS') {
    fibiSettings.focusMinutes = parseInt(request.settings.focusMinutes) || 25;
    fibiSettings.breakMinutes = parseInt(request.settings.breakMinutes) || 5;
    chrome.storage.local.set({ fibiSettings });
    
    // Kalau timer lagi ga jalan, langsung update waktu yang ditampilin di layar
    if (!timerState.isRunning) {
        timerState.timeLeft = timerState.mode === 'focus' ? fibiSettings.focusMinutes * 60 : fibiSettings.breakMinutes * 60;
        chrome.storage.local.set({ timerState });
    }
    
    broadcastState();
    sendResponse({ success: true });
  }
  return true; 
});
