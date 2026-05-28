const WS_URL = 'ws://localhost:8080';
let ws;

// DOM Elements
const connectionDot = document.getElementById('connection-dot');
const connectionText = document.getElementById('connection-text');
const statProfit = document.getElementById('stat-profit');
const statTrades = document.getElementById('stat-trades');
const statOpps = document.getElementById('stat-opps');
const statScans = document.getElementById('stat-scans');
const statUptime = document.getElementById('stat-uptime');
const activityBody = document.getElementById('activity-body');
const terminalOutput = document.getElementById('terminal-output');
const soundToggle = document.getElementById('sound-toggle');

// Audio Alert (Base64 short UI ping sound)
// A simple short notification beep
const alertSound = new Audio('data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq');
// Note: since a valid MP3 base64 is long, I am using a trick: creating a simple Oscillator with Web Audio API for the beep to keep the file clean.
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playAlert() {
    if (!soundToggle.checked) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
    oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.3);
}

// Chart.js Setup
let profitChart;
const chartData = {
    labels: [],
    datasets: [{
        label: 'Total Profit (ETH)',
        data: [],
        borderColor: '#00ff88',
        backgroundColor: 'rgba(0, 255, 136, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#0a0a0f',
        pointBorderColor: '#00ff88',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6
    }]
};

function initChart() {
    const ctx = document.getElementById('profitChart').getContext('2d');
    profitChart = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(10, 10, 15, 0.9)',
                    titleColor: '#8a8a98',
                    bodyColor: '#f0f0f5',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    display: false // Hide x axis labels to keep it clean
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#8a8a98',
                        callback: function(value) { return value.toFixed(3) + ' ETH'; }
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });

    // Add initial data point
    updateChart(0, new Date().toLocaleTimeString());
}

function updateChart(profitValue, timeLabel) {
    chartData.labels.push(timeLabel);
    chartData.datasets[0].data.push(profitValue);
    
    // Keep last 20 data points
    if (chartData.labels.length > 20) {
        chartData.labels.shift();
        chartData.datasets[0].data.shift();
    }
    
    profitChart.update();
}

function connect() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        connectionDot.className = 'dot connected';
        connectionText.textContent = 'Connected';
        addLogToTerminal('info', 'WebSocket connection established.');
    };

    ws.onclose = () => {
        connectionDot.className = 'dot disconnected';
        connectionText.textContent = 'Disconnected - Retrying...';
        addLogToTerminal('error', 'WebSocket connection lost. Retrying...');
        setTimeout(connect, 2000);
    };

    ws.onerror = (err) => {
        console.error('WebSocket error:', err);
    };

    ws.onmessage = (event) => {
        try {
            const payload = JSON.parse(event.data);
            if (payload.type === 'stats') {
                updateDashboard(payload.data);
            } else if (payload.type === 'log') {
                addLogToTerminal(payload.data.level, payload.data.message);
            }
        } catch (e) {
            console.error('Failed to parse message:', e);
        }
    };
}

let lastProfitValue = 0;

function updateDashboard(data) {
    // Update Stats
    const currentProfit = Number(data.profit);
    statProfit.textContent = `${currentProfit.toFixed(4)} ETH`;
    statTrades.textContent = data.trades.toLocaleString();
    statOpps.textContent = data.opps.toLocaleString();
    statScans.textContent = data.scans.toLocaleString();
    
    // Format Uptime
    const hours = Math.floor(data.uptime / 3600000);
    const minutes = Math.floor((data.uptime % 3600000) / 60000);
    statUptime.textContent = `${hours}h ${minutes}m`;

    // Update Chart if profit changed
    if (currentProfit !== lastProfitValue && currentProfit > 0) {
        updateChart(currentProfit, new Date().toLocaleTimeString());
        lastProfitValue = currentProfit;
    }

    // Handle New Trades / Opportunities
    if (data.newTrade) {
        addActivityRow(data.newTrade);
    }
}

let lastProcessedTradeStr = "";

function addActivityRow(trade) {
    // Prevent duplicate rows from same broadcast state
    const tradeStr = JSON.stringify(trade);
    if (tradeStr === lastProcessedTradeStr) return;
    lastProcessedTradeStr = tradeStr;

    // Play sound alert for new opportunity
    playAlert();

    // Remove empty state if it exists
    const emptyState = document.getElementById('empty-state');
    if (emptyState) {
        emptyState.remove();
    }

    const row = document.createElement('tr');
    row.className = 'new-row';
    
    const time = new Date().toLocaleTimeString();
    const statusClass = trade.status === 'success' ? 'status-success' : 'status-pending';
    const statusText = trade.status === 'success' ? 'Landed' : 'Found';

    row.innerHTML = `
        <td>${time}</td>
        <td>${trade.pair || 'Unknown'}</td>
        <td>${trade.buyDex} ➔ ${trade.sellDex}</td>
        <td class="highlight">+${Number(trade.profit).toFixed(4)}</td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
    `;

    activityBody.insertBefore(row, activityBody.firstChild);

    // Keep only last 10 rows
    if (activityBody.children.length > 10) {
        activityBody.removeChild(activityBody.lastChild);
    }

    // Remove the highlight animation class after it plays
    setTimeout(() => {
        row.classList.remove('new-row');
    }, 1000);
}

function addLogToTerminal(level, message) {
    const time = new Date().toLocaleTimeString([], { hour12: false });
    const logLine = document.createElement('div');
    logLine.className = 'log-line';
    
    let levelClass = 'log-info';
    if (level === 'warn') levelClass = 'log-warn';
    if (level === 'error') levelClass = 'log-error';

    // Format the message nicely
    // Replace standard newlines with HTML breaks
    const formattedMessage = message.replace(/\\n/g, '<br>').replace(/ /g, '&nbsp;');

    logLine.innerHTML = `<span class="log-time">[${time}]</span><span class="${levelClass}">${formattedMessage}</span>`;
    
    terminalOutput.appendChild(logLine);

    // Keep terminal from getting too long (max 200 lines)
    if (terminalOutput.children.length > 200) {
        terminalOutput.removeChild(terminalOutput.firstChild);
    }

    // Auto-scroll to bottom
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

// Init
initChart();
connect();
