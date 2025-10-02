# 🛡️ Discord Moderation Bot  

A powerful and customizable **Discord Moderation Bot** built with **Node.js** and **discord.js v14**.  
This bot helps keep your server safe, clean, and fun with moderation, utility, role management, and fun features.  

---

## ⚡ Features  

### 🔧 Moderation
- `!ping` → Check bot latency  
- `!kick @user reason` → Kick a user  
- `!ban @user reason` → Ban a user  
- `!purge <1-100>` → Bulk delete messages  
- `!purge @user <1-100>` → Delete a specific user’s messages  
- `!purge all` → Clear all messages (by cloning the channel)  
- `!mute @user <time>` → Timeout a user (s/m/h/d supported)  
- `!unmute @user` → Remove timeout  

### 📊 Information
- `!serverinfo` → Server information (ID, owner, members, roles, boosts, etc.)  
- `!userinfo @user` / `!whois` → User info (ID, roles, join date, account creation, etc.)  
- `!avatar @user` / `!av` → User avatar with download link  
- `!roleinfo @role` → Role details (ID, color, permissions, etc.)  

### 🛠️ Utility
- `!poll <question>` → Create a poll (✅ ❌ 🤷)  
- `!suggest <text>` → Add a suggestion (👍 👎 reactions)  
- `!calc <expression>` → Simple calculator (`+ - * /`)  
- `!weather <city>` → Weather info (via OpenWeather API)  

### 🎉 Fun
- `!8ball <question>` → Magic 8-ball answers  
- `!random <min> <max>` / `!roll` → Random number generator  
- `!choose option1, option2, ...` / `!pick` → Random choice  

### 🎭 Role Management
- `!role add @user @role` → Add role to user  
- `!role remove @user @role` → Remove role from user  
- `!list` → List all server roles  
- `!roles @user` / `!checkroles` → Show user’s roles  

---

## 🛠️ Tech Stack
- [Node.js](https://nodejs.org/)  
- [discord.js v14](https://discord.js.org/)  
- [dotenv](https://www.npmjs.com/package/dotenv)  

---

## 🚀 Installation  

1. Clone this repo  
   ```bash
   git clone https://github.com/your-username/your-repo-name.git
   cd your-repo-name

## Install dependencies
 - npm install
## Create a .env file in the root directory and add:
- DISCORD_TOKEN=your-bot-token-here
- PREFIX=!
## Start the bot 
- node index.js


