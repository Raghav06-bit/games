<div align="center">
  <br />
  <h1>🎮 Neon X O — Real-time Multiplayer Tic-Tac-Toe</h1>
  <p>A beautifully designed, real-time multiplayer Tic-Tac-Toe game built with Node.js and Socket.IO. Play against an unbeatable AI, pass-and-play locally, or challenge friends across the world with private room codes.</p>
  
  <p>
    <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript" />
    <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
    <img src="https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express.js" />
    <img src="https://img.shields.io/badge/Socket.IO-010101?style=for-the-badge&logo=socket.io&logoColor=white" alt="Socket.io" />
    <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3" />
  </p>
</div>

<br />

## ✨ Features

- **🌐 Online Multiplayer:** Create private rooms, share your 6-character code, and sync your moves with friends in real-time instantly.
- **🤖 Play vs AI:** Challenge a built-in bot with three different difficulty modes. The "Hard" mode runs the classic Minimax algorithm rendering it mathematically unbeatable!
- **👥 Local 2-Player:** Easily pass and play on a single screen.
- **🎨 Glassmorphic Neon UI:** Clean, dark-mode design featuring smooth CSS-based box shadows, glowing accents, and high-contrast typography.
- **📱 Fully Responsive:** Beautiful layouts scaled perfectly for mobile phones, tablets, and desktop displays.

---

## 🚀 Quick Start (Local Development)

Want to run the game on your own machine? It takes just a few seconds!

### 1. Clone the repository
```bash
git clone https://github.com/Raghav06-bit/games.git
cd games
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start the Server
```bash
npm start
```
The server will now be running. Open **[http://localhost:3000](http://localhost:3000)** in your browser!

> **Pro Tip:** To test the online multiplayer mode locally, open the link in two separate windows, create a room in one, and join it in the other.

---

## 🌍 Free Deployment (Render)

This project has been pre-configured with a `/healthz` endpoint, making it 100% ready for free deployment on modern cloud platforms like [Render](https://render.com/).

**To host it yourself:**
1. Upload this repository to your GitHub account.
2. Go to **Render.com** and create a new **Web Service**.
3. Connect your repository.
4. Set the build command to `npm install` and the run command to `npm start`.
5. Select the **Free Tier** and deploy!

*(Note: On Render's free tier, the server will "sleep" after 15 minutes of inactivity. When a player visits, it takes ~30-50 seconds to wake the server back up).*

---

## 🛠 Tech Architecture

- **Backend:** Node.js server powered by Express to serve static files. real-time WebSockets managed perfectly using Socket.IO instances and Room structures.
- **Frontend:** Pure HTML/CSS/JavaScript (Vanilla). Zero build required.
- **State Management:** Board states, current turn, player symbols, and rematch requests are mapped and managed centrally to prevent client de-synchronization.

---

<div align="center">
  <i>If you like this project, consider starring the repository! ⭐</i>
</div>