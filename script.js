const API_BASE_URL = 'https://pomodoro-springboot-backend-production.up.railway.app/api/pomodoro'

const timeDisplay = document.getElementById('time-display');
const pomodoroDurationSelect = document.getElementById('pomodoro-duration-select');
const currentModeDisplay = document.getElementById('current-mode');
const statusMessageDisplay = document.getElementById('status-message');
const alarmSound = new Audio('Debussy_Clair_de_Lune.mp3');
alarmSound.preload = 'auto';

const startPomodoroBtn = document.getElementById('start-pomodoro-btn');
const startShortBreakBtn = document.getElementById('start-short-break-btn');
const startLongBreakBtn = document.getElementById('start-long-break-btn');
const stopBtn = document.getElementById('stop-btn');
const resetBtn = document.getElementById('reset-btn');

let currentTimerInterval = null;
let timeRemainingFrontend = 0;
let backendIsRunning = false;

function formatTime(totalSeconds) {
    if (isNaN(totalSeconds) || totalSeconds < 0) {
        return "00:00";
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function updateUI(data) {
    if (!data) return;

    timeDisplay.textContent = formatTime(data.timeRemainingInSeconds);
    currentModeDisplay.textContent = `Mode: ${data.currentMode || `IDLE`}`;
    statusMessageDisplay.textContent = data.message || `Status: updated`;
    backendIsRunning = data.isRunning || false;
    timeRemainingFrontend = data.timeRemainingInSeconds || 0;

    if (backendIsRunning) {
        disableStartButtons();
        stopBtn.disabled = false;
    } else {
        enableStartButtons();
        stopBtn.disabled = true;
    }

}

function disableStartButtons() {
    startPomodoroBtn.disabled = true;
    startShortBreakBtn.disabled = true;
    startLongBreakBtn.disabled = true;
}

function enableStartButtons() {
    startPomodoroBtn.disabled = false;
    startShortBreakBtn.disabled = false;
    startLongBreakBtn.disabled = false;
}

async function fetchAndUpdateStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/status`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log("Status from backend:", data);
        updateUI(data);
        if (data.isRunning) {
            startFrontendCountdown(data.timeRemainingInSeconds);
        } else {
            stopFrontendCountdown();
        }
    } catch (error) {
        console.error("Failed to fetch status:", error);
        statusMessageDisplay.textContent = "Error: Could not connect to backend.";
        timeDisplay.textContent = "XX:XX";
        currentModeDisplay.textContent = "Mode: ERROR";
        disableStartButtons();
        stopBtn.disabled = true;
    }
}

async function sendBackendRequest(endpoint, method = 'POST', params = null) {
    try {
        let url = `${API_BASE_URL}/${endpoint}`;
        const options = {method: method};

        if (method === 'POST' && params) {
            const queryParams = new URLSearchParams(params);
            url += `?${queryParams.toString()}`;
        }

        const response = await fetch(url, options);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`HTTP error! status: ${response.status} - ${errorData.message || 'Unknown error'}`);
        }
        const data = await response.json();
        console.log(`Response from ${endpoint}:`, data);
        updateUI(data);
        return data;
    } catch (error) {
        console.error(`Failed to send request to ${endpoint}:`, error);
        statusMessageDisplay.textContent = `Error: ${error.message}`;
        await fetchAndUpdateStatus();
        return null;
    }
}
function startFrontendCountdown(initialSeconds) {
    stopFrontendCountdown();
    stopAndResetAlarmSound();
    timeRemainingFrontend = initialSeconds;
    updateDisplayTimeOnly(timeRemainingFrontend);

    if (timeRemainingFrontend <= 0 && backendIsRunning) {
        playAlarmSound();
        sendBackendRequest('complete');
        return;
    }
    if (timeRemainingFrontend <= 0) return;

    currentTimerInterval = setInterval(() => {
        timeRemainingFrontend--;
        updateDisplayTimeOnly(timeRemainingFrontend);

        if (timeRemainingFrontend <= 0) {
            stopFrontendCountdown();
            statusMessageDisplay.textContent = "Time's up!";
            playAlarmSound();
            sendBackendRequest('complete');
        }
    }, 1000);
}

function stopFrontendCountdown() {
    if (currentTimerInterval) {
        clearInterval(currentTimerInterval);
        currentTimerInterval = null;
    }
}

function updateDisplayTimeOnly(seconds) {
    timeDisplay.textContent = formatTime(seconds);
}

function playAlarmSound() {
    alarmSound.currentTime = 3;
    alarmSound.play().catch(error => {
        console.warn("Audio play was prevented: ", error);
    });
}
function stopAndResetAlarmSound() {
    if (!alarmSound.paused) {
        alarmSound.pause();
    }
    alarmSound.currentTime = 0;
}
startPomodoroBtn.addEventListener('click', async () => {
    stopFrontendCountdown();
    stopAndResetAlarmSound();
    const selectedDuration = parseInt(pomodoroDurationSelect.value, 10);
    const params = {
        mode: 'POMODORO',
        duration: selectedDuration,
    }
    const data = await sendBackendRequest('start', 'POST', params);
    if (data && data.isRunning) {
        startFrontendCountdown(data.timeRemainingInSeconds);
    }
});

startShortBreakBtn.addEventListener('click', async () => {
    stopFrontendCountdown();
    stopAndResetAlarmSound();
    const data = await sendBackendRequest('start', 'POST', { mode: 'SHORT_BREAK' });
    if (data && data.isRunning) {
        startFrontendCountdown(data.timeRemainingInSeconds);
    }
});

startLongBreakBtn.addEventListener('click', async () => {
    stopFrontendCountdown();
    stopAndResetAlarmSound();
    const data = await sendBackendRequest('start', 'POST', { mode: 'LONG_BREAK' });
    if (data && data.isRunning) {
        startFrontendCountdown(data.timeRemainingInSeconds);
    }
});

stopBtn.addEventListener('click', async () => {
    stopFrontendCountdown();
    stopAndResetAlarmSound();
    await sendBackendRequest('stop');
});

resetBtn.addEventListener('click', async () => {
    stopFrontendCountdown();
    stopAndResetAlarmSound();
    await sendBackendRequest('reset');
});



document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed");
    fetchAndUpdateStatus();
});
