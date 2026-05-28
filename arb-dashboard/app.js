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

function connect() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        connectionDot.className = 'dot connected';
        connectionText.textContent = 'Connected';
    };

    ws.onclose = () => {
        connectionDot.className = 'dot disconnected';
        connectionText.textContent = 'Disconnected - Retrying...';
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
            }
        } catch (e) {
            console.error('Failed to parse message:', e);
        }
    };
}

function updateDashboard(data) {
    // Update Stats
    statProfit.textContent = `${Number(data.profit).toFixed(4)} ETH`;
    statTrades.textContent = data.trades.toLocaleString();
    statOpps.textContent = data.opps.toLocaleString();
    statScans.textContent = data.scans.toLocaleString();
    
    // Format Uptime
    const hours = Math.floor(data.uptime / 3600000);
    const minutes = Math.floor((data.uptime % 3600000) / 60000);
    statUptime.textContent = `${hours}h ${minutes}m`;

    // Handle New Trades / Opportunities
    if (data.newTrade) {
        addActivityRow(data.newTrade);
    }
}

function addActivityRow(trade) {
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

// Start connection
connect();
