# Prompt Game Tournament Results - Web Display Exercise

## 🌐 Live Demo

**View the website**: [https://zwhou99.github.io/prompt-chess-game-vibe-coding-exercise/](https://zwhou99.github.io/prompt-chess-game-vibe-coding-exercise/)

## Exercise Description

This repository contains tournament results data from a prompt-based game competition. Your task is to create a website that displays these results in an engaging and informative way.

## Data Structure

The `data/` folder contains:
- **`final_standings.csv`**: Tournament standings with player rankings, ratings, and game statistics
  - Columns: `Rank`, `Player`, `Rating_Mu`, `Rating_Sigma`, `Wins`, `Draws`, `Losses`, `Games`, `Win_Rate`
- **`prompt_collection/`**: Individual player configuration files (YAML format)

## Your Task

Create a website that displays the tournament results with the following requirements:

### Minimum Requirements
1. **Display the leaderboard** - Show all players ranked by their final standings
2. **Visualize statistics** - Include charts or graphs showing:
   - Win rates
   - Rating distributions
   - Game statistics (wins, draws, losses)
3. **Player details** - Allow users to view individual player statistics
4. **Responsive design** - The website should work on desktop and mobile devices

### Suggested Features (Optional)
- Interactive filtering and sorting
- Search functionality for players
- Comparison view between players
- Export functionality
- Dark/light theme toggle

## Getting Started

1. Clone this repository
2. Explore the data files to understand the structure
3. Choose your tech stack (e.g., HTML/CSS/JavaScript, React, Vue, Python Flask/Django, etc.)
4. Build your website to display the results
5. Test your implementation
6. Submit your solution

## Data Preview

The tournament includes multiple players with their game statistics. Each player has:
- A ranking position
- Rating metrics (Mu and Sigma)
- Win/Draw/Loss record
- Total games played
- Win rate percentage

## Implementation

### ✅ Features Implemented

**All minimum requirements:**
- ✅ Interactive leaderboard with all player rankings
- ✅ Multiple data visualizations (Chart.js):
  - Win rate bar chart (top 10 players)
  - Rating distribution histogram
  - Game statistics comparison (top 15 players)
- ✅ Detailed player statistics modal
- ✅ Fully responsive design for desktop, tablet, and mobile

**All optional features:**
- ✅ Advanced filtering and sorting
  - Sort by final standing, mu rating, win rate, or games played
  - Filter by win rate ranges (≥60%, 40-60%, <40%)
  - Filter by game counts (full 12 games or partial)
- ✅ Real-time search functionality
- ✅ Player comparison view (side-by-side)
- ✅ Export functionality (CSV and JSON formats)
- ✅ Dark/light theme toggle with persistence

**Additional features:**
- Pin players to top of leaderboard
- Visual highlighting (top 3 players, high win rates)
- Display model configurations and prompts
- Interactive statistics dashboard
- Checkbox selection for player comparison

### 🛠 Tech Stack

- **Frontend**: Vanilla JavaScript (ES6+)
- **Styling**: CSS3 with custom properties for theming
- **Visualizations**: Chart.js 4.4.0
- **Data Parsing**: js-yaml 4.1.0 for YAML config files
- **Hosting**: GitHub Pages

### 📁 Project Structure

```
.
├── index.html           # Main HTML structure
├── styles.css           # Styling with light/dark theme support
├── script.js            # JavaScript functionality
├── data/
│   ├── final_standings.csv         # Tournament results
│   ├── player_configs.json         # Config file index
│   └── prompt_collection/          # YAML config files
```

### 🚀 Local Development

```bash
# Clone the repository
git clone https://github.com/zwhou99/prompt-chess-game-vibe-coding-exercise.git

# Navigate to the directory
cd prompt-chess-game-vibe-coding-exercise

# Start a local server
python3 -m http.server 8000

# Open in browser
open http://localhost:8000
```

## Submission

**GitHub Repository**: [https://github.com/zwhou99/prompt-chess-game-vibe-coding-exercise](https://github.com/zwhou99/prompt-chess-game-vibe-coding-exercise)

**Live Website**: [https://zwhou99.github.io/prompt-chess-game-vibe-coding-exercise/](https://zwhou99.github.io/prompt-chess-game-vibe-coding-exercise/)

## License
MIT License

