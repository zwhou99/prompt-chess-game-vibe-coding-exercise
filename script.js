// Global variables
let playersData = [];
let filteredData = [];
let charts = {};
let playerConfigs = {}; // Store YAML config data for each player
let pinnedPlayer = null; // Track pinned player
let selectedPlayers = new Set(); // Track selected players for comparison
let highlightSettings = {
    top3: true,
    winRate: false
};
let displaySettings = {
    model: false,
    prompts: false
};
let filterSettings = {
    winRate: 'all',
    games: 'all'
};

// Load and parse CSV data
async function loadCSVData() {
    try {
        console.log('Attempting to load CSV data...');
        const response = await fetch('data/final_standings.csv');

        console.log('Response status:', response.status);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const csvText = await response.text();
        console.log('CSV loaded, length:', csvText.length);

        // Parse CSV
        const lines = csvText.trim().split('\n');
        console.log('Number of lines:', lines.length);
        const headers = lines[0].split(',');

        playersData = lines.slice(1).map(line => {
            const values = line.split(',');
            return {
                rank: parseInt(values[0]),
                player: values[1],
                rating_mu: parseFloat(values[2]),
                rating_sigma: parseFloat(values[3]),
                wins: parseInt(values[4]),
                draws: parseInt(values[5]),
                losses: parseInt(values[6]),
                games: parseInt(values[7]),
                win_rate: parseFloat(values[8])
            };
        });

        console.log('Parsed players:', playersData.length);
        filteredData = [...playersData];

        // Initialize everything
        updateStatistics();
        await loadPlayerConfigs(); // Load YAML configs
        populateLeaderboard();
        createCharts();

    } catch (error) {
        console.error('Error loading data:', error);
        console.error('Error details:', error.message);
        document.getElementById('leaderboardBody').innerHTML =
            `<tr><td colspan="13" style="text-align: center; color: red;">
            Error loading data: ${error.message}<br>
            Please ensure you are accessing the page via HTTP server (e.g., python3 -m http.server 8000)<br>
            and navigate to http://localhost:8000
            </td></tr>`;
    }
}

// Load player YAML configuration files
async function loadPlayerConfigs() {
    console.log('Loading player configurations...');

    try {
        // Load the index of config files
        const indexResponse = await fetch('data/player_configs.json');
        const configFiles = await indexResponse.json();

        for (const player of playersData) {
            try {
                // Find matching YAML file (player name is prefix of filename)
                const matchingFile = configFiles.find(file =>
                    file.startsWith(player.player) && file.endsWith('.yml')
                );

                if (matchingFile) {
                    const configResponse = await fetch(`data/prompt_collection/${matchingFile}`);
                    const yamlText = await configResponse.text();

                    // Parse YAML using js-yaml library
                    const config = jsyaml.load(yamlText);
                    playerConfigs[player.player] = config;
                    console.log(`Loaded config for ${player.player}`);
                } else {
                    console.warn(`No config file found for ${player.player}`);
                }
            } catch (error) {
                console.error(`Error loading config for ${player.player}:`, error);
            }
        }

        console.log(`Loaded ${Object.keys(playerConfigs).length} player configurations`);
    } catch (error) {
        console.error('Error loading player configs index:', error);
    }
}

// Get model info for a player
function getModelInfo(player) {
    const config = playerConfigs[player];
    if (!config) return { agent0: 'N/A', agent1: 'N/A' };

    const agent0Model = config.agent0?.model
        ? `${config.agent0.model.provider} - ${config.agent0.model.name}`
        : 'N/A';
    const agent1Model = config.agent1?.model
        ? `${config.agent1.model.provider} - ${config.agent1.model.name}`
        : 'N/A';

    return { agent0: agent0Model, agent1: agent1Model };
}

// Get prompts for a player
function getPrompts(player) {
    const config = playerConfigs[player];
    if (!config) return {
        agent0System: 'N/A',
        agent0Step: 'N/A',
        agent1System: 'N/A',
        agent1Step: 'N/A'
    };

    return {
        agent0System: config.agent0?.prompts?.system_prompt || 'N/A',
        agent0Step: config.agent0?.prompts?.step_wise_prompt || 'N/A',
        agent1System: config.agent1?.prompts?.system_prompt || 'N/A',
        agent1Step: config.agent1?.prompts?.step_wise_prompt || 'N/A'
    };
}

// Update statistics overview
function updateStatistics() {
    const totalPlayers = playersData.length;
    const totalGames = playersData.reduce((sum, p) => sum + p.games, 0);
    const avgWinRate = (playersData.reduce((sum, p) => sum + p.win_rate, 0) / totalPlayers).toFixed(3);
    const topRating = Math.max(...playersData.map(p => p.rating_mu)).toFixed(2);

    document.getElementById('totalPlayers').textContent = totalPlayers;
    document.getElementById('totalGames').textContent = totalGames;
    document.getElementById('avgWinRate').textContent = avgWinRate;
    document.getElementById('topRating').textContent = topRating;
}

// Apply filters to data
function applyFilters() {
    filteredData = playersData.filter(player => {
        // Search filter
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        if (searchTerm && !player.player.toLowerCase().includes(searchTerm)) {
            return false;
        }

        // Win rate filter
        if (filterSettings.winRate !== 'all') {
            const winRate = player.win_rate;
            if (filterSettings.winRate === 'high' && winRate < 0.6) return false;
            if (filterSettings.winRate === 'medium' && (winRate < 0.4 || winRate >= 0.6)) return false;
            if (filterSettings.winRate === 'low' && winRate >= 0.4) return false;
        }

        // Games filter
        if (filterSettings.games !== 'all') {
            if (filterSettings.games === 'full' && player.games !== 12) return false;
            if (filterSettings.games === 'partial' && player.games === 12) return false;
        }

        return true;
    });

    applySorting();
    populateLeaderboard(filteredData);
}

// Populate leaderboard table
function populateLeaderboard(data = filteredData) {
    const tbody = document.getElementById('leaderboardBody');
    tbody.innerHTML = '';

    // Sort data: pinned player first, then the rest
    let sortedData = [...data];
    if (pinnedPlayer) {
        sortedData = sortedData.sort((a, b) => {
            if (a.player === pinnedPlayer) return -1;
            if (b.player === pinnedPlayer) return 1;
            return 0;
        });
    }

    sortedData.forEach(player => {
        const row = document.createElement('tr');

        // Apply highlight classes
        const isPinned = player.player === pinnedPlayer;
        const isTop3 = player.rank <= 3 && highlightSettings.top3;
        const isHighWinRate = player.win_rate > 0.8 && highlightSettings.winRate;

        if (isPinned) {
            row.classList.add('pinned-row');
        } else if (isHighWinRate) {
            row.classList.add('highlighted-winrate');
        } else if (isTop3) {
            row.classList.add('highlighted-top3');
        }

        const rankClass = player.rank <= 3 ? `rank-${player.rank}` : '';
        const winRateClass = player.win_rate >= 0.6 ? 'high' : player.win_rate >= 0.4 ? 'medium' : 'low';

        // Get model info
        const modelInfo = getModelInfo(player.player);
        const prompts = getPrompts(player.player);

        // Build row HTML
        let rowHTML = `
            <td>
                <input type="checkbox" class="player-select"
                       data-player="${player.player}"
                       ${selectedPlayers.has(player.player) ? 'checked' : ''}
                       onchange="togglePlayerSelection('${player.player}')">
            </td>
            <td>
                <button class="pin-btn ${isPinned ? 'pinned' : 'unpinned'}"
                        onclick="togglePin('${player.player}')"
                        title="${isPinned ? 'Unpin' : 'Pin'} player">
                    ${isPinned ? '📌' : '📍'}
                </button>
            </td>
            <td><span class="rank-badge ${rankClass}">#${player.rank}</span></td>
            <td class="player-name">${player.player}</td>
            <td>${player.rating_mu.toFixed(2)}</td>
            <td>${player.rating_sigma.toFixed(2)}</td>
            <td>${player.games}</td>
            <td>${player.wins}</td>
            <td>${player.draws}</td>
            <td>${player.losses}</td>
            <td><span class="win-rate ${winRateClass}">${(player.win_rate * 100).toFixed(1)}%</span></td>
        `;

        // Add model column (conditionally displayed)
        rowHTML += `
            <td class="model-column model-info-cell" style="display: ${displaySettings.model ? 'table-cell' : 'none'};">
                <div class="model-line"><strong>Agent 0:</strong> ${modelInfo.agent0}</div>
                <div class="model-line"><strong>Agent 1:</strong> ${modelInfo.agent1}</div>
            </td>
        `;

        // Add prompts column (conditionally displayed)
        const promptPreview = prompts.agent0System.substring(0, 150) + '...';
        rowHTML += `
            <td class="prompts-column prompts-cell" style="display: ${displaySettings.prompts ? 'table-cell' : 'none'};">
                <div class="prompt-preview">${promptPreview}</div>
                <button class="view-more-btn" onclick="showPlayerDetails('${player.player}')">View Full</button>
            </td>
        `;

        rowHTML += `
            <td><button class="view-btn" onclick="showPlayerDetails('${player.player}')">View</button></td>
        `;

        row.innerHTML = rowHTML;
        tbody.appendChild(row);
    });
}

// Toggle pin for a player
function togglePin(playerName) {
    if (pinnedPlayer === playerName) {
        pinnedPlayer = null;
    } else {
        pinnedPlayer = playerName;
    }
    populateLeaderboard();
}

// Toggle column visibility
function toggleColumnVisibility(columnClass, show) {
    const headers = document.querySelectorAll(`th.${columnClass}`);
    const cells = document.querySelectorAll(`td.${columnClass}`);

    headers.forEach(el => {
        el.style.display = show ? 'table-cell' : 'none';
    });
    cells.forEach(el => {
        el.style.display = show ? 'table-cell' : 'none';
    });
}

// Get chart colors based on theme
function getChartColors() {
    const isDark = document.body.classList.contains('dark-theme');
    return {
        text: isDark ? '#eaeaea' : '#2c3e50',
        grid: isDark ? '#2a2a3e' : '#bdc3c7'
    };
}

// Create charts
function createCharts() {
    createWinRateChart();
    createRatingDistributionChart();
    createGameStatsChart();
}

// Win Rate Chart
function createWinRateChart() {
    const ctx = document.getElementById('winRateChart').getContext('2d');
    const top10 = [...playersData].sort((a, b) => b.win_rate - a.win_rate).slice(0, 10);
    const colors = getChartColors();

    if (charts.winRateChart) charts.winRateChart.destroy();

    charts.winRateChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: top10.map(p => p.player),
            datasets: [{
                label: 'Win Rate (%)',
                data: top10.map(p => p.win_rate * 100),
                backgroundColor: 'rgba(52, 152, 219, 0.7)',
                borderColor: 'rgba(52, 152, 219, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Win Rate: ${context.parsed.y.toFixed(1)}%`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Win Rate (%)',
                        color: colors.text
                    },
                    ticks: {
                        color: colors.text
                    },
                    grid: {
                        color: colors.grid
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        color: colors.text
                    },
                    grid: {
                        color: colors.grid
                    }
                }
            }
        }
    });
}

// Rating Distribution Chart
function createRatingDistributionChart() {
    const ctx = document.getElementById('ratingDistChart').getContext('2d');
    const colors = getChartColors();

    // Create rating bins
    const bins = [
        { label: '0-15', min: 0, max: 15, count: 0 },
        { label: '15-20', min: 15, max: 20, count: 0 },
        { label: '20-25', min: 20, max: 25, count: 0 },
        { label: '25-30', min: 25, max: 30, count: 0 },
        { label: '30-35', min: 30, max: 35, count: 0 },
        { label: '35-40', min: 35, max: 40, count: 0 },
        { label: '40+', min: 40, max: Infinity, count: 0 }
    ];

    playersData.forEach(player => {
        const bin = bins.find(b => player.rating_mu >= b.min && player.rating_mu < b.max);
        if (bin) bin.count++;
    });

    if (charts.ratingDistChart) charts.ratingDistChart.destroy();

    charts.ratingDistChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: bins.map(b => b.label),
            datasets: [{
                label: 'Number of Players',
                data: bins.map(b => b.count),
                backgroundColor: 'rgba(46, 204, 113, 0.7)',
                borderColor: 'rgba(46, 204, 113, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Players: ${context.parsed.y}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        color: colors.text
                    },
                    title: {
                        display: true,
                        text: 'Number of Players',
                        color: colors.text
                    },
                    grid: {
                        color: colors.grid
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Rating Range (μ)',
                        color: colors.text
                    },
                    ticks: {
                        color: colors.text
                    },
                    grid: {
                        color: colors.grid
                    }
                }
            }
        }
    });
}

// Game Statistics Chart
function createGameStatsChart() {
    const ctx = document.getElementById('gameStatsChart').getContext('2d');
    const top15 = playersData.slice(0, 15);
    const colors = getChartColors();

    if (charts.gameStatsChart) charts.gameStatsChart.destroy();

    charts.gameStatsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: top15.map(p => p.player),
            datasets: [
                {
                    label: 'Wins',
                    data: top15.map(p => p.wins),
                    backgroundColor: 'rgba(39, 174, 96, 0.7)',
                    borderColor: 'rgba(39, 174, 96, 1)',
                    borderWidth: 2
                },
                {
                    label: 'Draws',
                    data: top15.map(p => p.draws),
                    backgroundColor: 'rgba(243, 156, 18, 0.7)',
                    borderColor: 'rgba(243, 156, 18, 1)',
                    borderWidth: 2
                },
                {
                    label: 'Losses',
                    data: top15.map(p => p.losses),
                    backgroundColor: 'rgba(231, 76, 60, 0.7)',
                    borderColor: 'rgba(231, 76, 60, 1)',
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: colors.text
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: {
                    stacked: false,
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        color: colors.text
                    },
                    grid: {
                        color: colors.grid
                    }
                },
                y: {
                    stacked: false,
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Games',
                        color: colors.text
                    },
                    ticks: {
                        color: colors.text
                    },
                    grid: {
                        color: colors.grid
                    }
                }
            }
        }
    });
}

// Show player details in modal
function showPlayerDetails(playerName) {
    const player = playersData.find(p => p.player === playerName);
    if (!player) return;

    // Update modal content
    document.getElementById('modalPlayerName').textContent = player.player;
    document.getElementById('modalRank').textContent = `#${player.rank}`;
    document.getElementById('modalRating').textContent = player.rating_mu.toFixed(2);
    document.getElementById('modalSigma').textContent = player.rating_sigma.toFixed(2);
    document.getElementById('modalWinRate').textContent = `${(player.win_rate * 100).toFixed(1)}%`;
    document.getElementById('modalGames').textContent = player.games;
    document.getElementById('modalWins').textContent = player.wins;
    document.getElementById('modalDraws').textContent = player.draws;
    document.getElementById('modalLosses').textContent = player.losses;

    // Update model information
    const modelInfo = getModelInfo(player.player);
    const modelSection = document.getElementById('modalModelSection');
    if (playerConfigs[player.player]) {
        modelSection.style.display = 'block';
        document.getElementById('modalAgent0Model').textContent = modelInfo.agent0;
        document.getElementById('modalAgent1Model').textContent = modelInfo.agent1;
    } else {
        modelSection.style.display = 'none';
    }

    // Update prompts information
    const prompts = getPrompts(player.player);
    const promptsSection = document.getElementById('modalPromptsSection');
    if (playerConfigs[player.player]) {
        promptsSection.style.display = 'block';
        document.getElementById('modalAgent0SystemPrompt').textContent = prompts.agent0System;
        document.getElementById('modalAgent0StepPrompt').textContent = prompts.agent0Step;
        document.getElementById('modalAgent1SystemPrompt').textContent = prompts.agent1System;
        document.getElementById('modalAgent1StepPrompt').textContent = prompts.agent1Step;
    } else {
        promptsSection.style.display = 'none';
    }

    // Create player result chart
    createPlayerResultChart(player);

    // Show modal
    document.getElementById('playerModal').style.display = 'block';
}

// Create player result pie chart
function createPlayerResultChart(player) {
    const ctx = document.getElementById('playerResultChart').getContext('2d');

    if (charts.playerResultChart) {
        charts.playerResultChart.destroy();
    }

    charts.playerResultChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Wins', 'Draws', 'Losses'],
            datasets: [{
                data: [player.wins, player.draws, player.losses],
                backgroundColor: [
                    'rgba(39, 174, 96, 0.8)',
                    'rgba(243, 156, 18, 0.8)',
                    'rgba(231, 76, 60, 0.8)'
                ],
                borderColor: [
                    'rgba(39, 174, 96, 1)',
                    'rgba(243, 156, 18, 1)',
                    'rgba(231, 76, 60, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Search and filter functionality
document.addEventListener('DOMContentLoaded', function() {
    // Load theme preference
    loadTheme();

    const searchInput = document.getElementById('searchInput');
    const sortSelect = document.getElementById('sortSelect');

    searchInput.addEventListener('input', applyFilters);
    sortSelect.addEventListener('change', function() {
        applySorting();
        populateLeaderboard(filteredData);
    });

    // Highlight checkboxes
    const highlightTop3 = document.getElementById('highlightTop3');
    const highlightWinRate = document.getElementById('highlightWinRate');

    highlightTop3.addEventListener('change', function(e) {
        highlightSettings.top3 = e.target.checked;
        populateLeaderboard(filteredData);
    });

    highlightWinRate.addEventListener('change', function(e) {
        highlightSettings.winRate = e.target.checked;
        populateLeaderboard(filteredData);
    });

    // Display checkboxes
    const showModel = document.getElementById('showModel');
    const showPrompts = document.getElementById('showPrompts');

    showModel.addEventListener('change', function(e) {
        displaySettings.model = e.target.checked;
        toggleColumnVisibility('model-column', e.target.checked);
    });

    showPrompts.addEventListener('change', function(e) {
        displaySettings.prompts = e.target.checked;
        toggleColumnVisibility('prompts-column', e.target.checked);
    });

    // Filter dropdowns
    const winRateFilter = document.getElementById('winRateFilter');
    const gamesFilter = document.getElementById('gamesFilter');

    winRateFilter.addEventListener('change', function(e) {
        filterSettings.winRate = e.target.value;
        applyFilters();
    });

    gamesFilter.addEventListener('change', function(e) {
        filterSettings.games = e.target.value;
        applyFilters();
    });

    // Action buttons
    document.getElementById('compareBtn').addEventListener('click', showComparison);
    document.getElementById('exportBtn').addEventListener('click', exportData);
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);

    // Select all checkbox
    document.getElementById('selectAll').addEventListener('change', function(e) {
        const checked = e.target.checked;
        selectedPlayers.clear();
        if (checked) {
            filteredData.slice(0, 2).forEach(p => selectedPlayers.add(p.player));
        }
        populateLeaderboard(filteredData);
        document.getElementById('compareBtn').disabled = selectedPlayers.size !== 2;
    });

    // Load data on page load
    loadCSVData();
});

// Apply sorting
function applySorting() {
    const sortBy = document.getElementById('sortSelect').value;

    switch(sortBy) {
        case 'rank':
            filteredData.sort((a, b) => a.rank - b.rank);
            break;
        case 'rating':
            filteredData.sort((a, b) => b.rating_mu - a.rating_mu);
            break;
        case 'winrate':
            filteredData.sort((a, b) => b.win_rate - a.win_rate);
            break;
        case 'games':
            filteredData.sort((a, b) => b.games - a.games);
            break;
    }
}

// Modal functionality
const playerModal = document.getElementById('playerModal');
const comparisonModal = document.getElementById('comparisonModal');
const closeBtns = document.getElementsByClassName('close');

// Add click handlers to all close buttons
Array.from(closeBtns).forEach(btn => {
    btn.onclick = function() {
        const modal = btn.closest('.modal');
        if (modal) {
            modal.style.display = 'none';
        }
    };
});

// Close modals when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}

// Toggle player selection for comparison
function togglePlayerSelection(playerName) {
    if (selectedPlayers.has(playerName)) {
        selectedPlayers.delete(playerName);
    } else {
        if (selectedPlayers.size >= 2) {
            // Remove oldest selection
            const first = selectedPlayers.values().next().value;
            selectedPlayers.delete(first);
        }
        selectedPlayers.add(playerName);
    }

    // Update compare button state
    const compareBtn = document.getElementById('compareBtn');
    compareBtn.disabled = selectedPlayers.size !== 2;

    // Update checkboxes
    document.querySelectorAll('.player-select').forEach(cb => {
        const player = cb.dataset.player;
        cb.checked = selectedPlayers.has(player);
    });
}

// Show comparison modal
function showComparison() {
    if (selectedPlayers.size !== 2) return;

    const players = Array.from(selectedPlayers);
    const player1 = playersData.find(p => p.player === players[0]);
    const player2 = playersData.find(p => p.player === players[1]);

    if (!player1 || !player2) return;

    // Update player 1 info
    document.getElementById('comparePlayer1Name').textContent = player1.player;
    document.getElementById('compare1Rank').textContent = `#${player1.rank}`;
    document.getElementById('compare1Rating').textContent = player1.rating_mu.toFixed(2);
    document.getElementById('compare1Sigma').textContent = player1.rating_sigma.toFixed(2);
    document.getElementById('compare1WinRate').textContent = `${(player1.win_rate * 100).toFixed(1)}%`;
    document.getElementById('compare1Games').textContent = player1.games;
    document.getElementById('compare1Wins').textContent = player1.wins;
    document.getElementById('compare1Draws').textContent = player1.draws;
    document.getElementById('compare1Losses').textContent = player1.losses;

    // Update player 2 info
    document.getElementById('comparePlayer2Name').textContent = player2.player;
    document.getElementById('compare2Rank').textContent = `#${player2.rank}`;
    document.getElementById('compare2Rating').textContent = player2.rating_mu.toFixed(2);
    document.getElementById('compare2Sigma').textContent = player2.rating_sigma.toFixed(2);
    document.getElementById('compare2WinRate').textContent = `${(player2.win_rate * 100).toFixed(1)}%`;
    document.getElementById('compare2Games').textContent = player2.games;
    document.getElementById('compare2Wins').textContent = player2.wins;
    document.getElementById('compare2Draws').textContent = player2.draws;
    document.getElementById('compare2Losses').textContent = player2.losses;

    // Update model info
    const model1 = getModelInfo(player1.player);
    const model2 = getModelInfo(player2.player);
    document.getElementById('compare1Model').innerHTML = `
        <strong>Agent 0:</strong> ${model1.agent0}<br>
        <strong>Agent 1:</strong> ${model1.agent1}
    `;
    document.getElementById('compare2Model').innerHTML = `
        <strong>Agent 0:</strong> ${model2.agent0}<br>
        <strong>Agent 1:</strong> ${model2.agent1}
    `;

    // Create comparison charts
    createComparisonCharts(player1, player2);

    // Show modal
    document.getElementById('comparisonModal').style.display = 'block';
}

// Create comparison charts
function createComparisonCharts(player1, player2) {
    // Chart 1
    const ctx1 = document.getElementById('compareChart1').getContext('2d');
    if (charts.compareChart1) charts.compareChart1.destroy();

    charts.compareChart1 = new Chart(ctx1, {
        type: 'doughnut',
        data: {
            labels: ['Wins', 'Draws', 'Losses'],
            datasets: [{
                data: [player1.wins, player1.draws, player1.losses],
                backgroundColor: [
                    'rgba(39, 174, 96, 0.8)',
                    'rgba(243, 156, 18, 0.8)',
                    'rgba(231, 76, 60, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });

    // Chart 2
    const ctx2 = document.getElementById('compareChart2').getContext('2d');
    if (charts.compareChart2) charts.compareChart2.destroy();

    charts.compareChart2 = new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: ['Wins', 'Draws', 'Losses'],
            datasets: [{
                data: [player2.wins, player2.draws, player2.losses],
                backgroundColor: [
                    'rgba(39, 174, 96, 0.8)',
                    'rgba(243, 156, 18, 0.8)',
                    'rgba(231, 76, 60, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

// Close comparison modal
function closeComparisonModal() {
    document.getElementById('comparisonModal').style.display = 'none';
}

// Export data functionality
function exportData() {
    const exportOptions = `
        <div style="padding: 1rem;">
            <h3>Export Data</h3>
            <p>Choose export format:</p>
            <button onclick="exportCSV()" style="margin: 0.5rem; padding: 0.5rem 1rem;">Export as CSV</button>
            <button onclick="exportJSON()" style="margin: 0.5rem; padding: 0.5rem 1rem;">Export as JSON</button>
        </div>
    `;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
            ${exportOptions}
        </div>
    `;
    document.body.appendChild(modal);
}

// Export as CSV
function exportCSV() {
    const headers = ['Rank', 'Player', 'Rating_Mu', 'Rating_Sigma', 'Wins', 'Draws', 'Losses', 'Games', 'Win_Rate'];
    const rows = filteredData.map(p => [
        p.rank, p.player, p.rating_mu, p.rating_sigma, p.wins, p.draws, p.losses, p.games, p.win_rate
    ]);

    let csv = headers.join(',') + '\n';
    csv += rows.map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tournament_results.csv';
    a.click();
    window.URL.revokeObjectURL(url);
}

// Export as JSON
function exportJSON() {
    const data = filteredData.map(p => ({
        rank: p.rank,
        player: p.player,
        rating_mu: p.rating_mu,
        rating_sigma: p.rating_sigma,
        wins: p.wins,
        draws: p.draws,
        losses: p.losses,
        games: p.games,
        win_rate: p.win_rate,
        model: getModelInfo(p.player)
    }));

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tournament_results.json';
    a.click();
    window.URL.revokeObjectURL(url);
}

// Theme toggle
function toggleTheme() {
    const body = document.body;
    const themeText = document.getElementById('themeText');
    const themeIcon = document.querySelector('#themeToggle .btn-icon');

    body.classList.toggle('dark-theme');

    if (body.classList.contains('dark-theme')) {
        themeText.textContent = 'Light Mode';
        themeIcon.textContent = '☀️';
        localStorage.setItem('theme', 'dark');
    } else {
        themeText.textContent = 'Dark Mode';
        themeIcon.textContent = '🌙';
        localStorage.setItem('theme', 'light');
    }

    // Recreate charts with new colors
    createCharts();
}

// Load theme preference
function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        document.getElementById('themeText').textContent = 'Light Mode';
        document.querySelector('#themeToggle .btn-icon').textContent = '☀️';
    }
}

// Make functions available globally
window.showPlayerDetails = showPlayerDetails;
window.togglePin = togglePin;
window.togglePlayerSelection = togglePlayerSelection;
window.closeComparisonModal = closeComparisonModal;
window.exportCSV = exportCSV;
window.exportJSON = exportJSON;
