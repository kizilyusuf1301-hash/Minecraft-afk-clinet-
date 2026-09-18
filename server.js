const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mineflayer = require('mineflayer');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Statik arayüz dosyalarını sun
app.use(express.static(path.join(__dirname, 'www')));

let bot = null;
let afkInterval = null;

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.action === 'CONNECT') {
        if (bot) {
          try { bot.quit(); } catch(e) {}
        }

        broadcast({ type: 'log', text: `[Bağlantı] ${data.host}:${data.port} sunucusuna 1.21.4 protokolüyle bağlanılıyor...`, color: '#facc15' });

        bot = mineflayer.createBot({
          host: data.host,
          port: parseInt(data.port) || 25565,
          username: data.username || 'AfkBot',
          version: '1.21.4',
          auth: 'offline', // Crackli sunucu modu
          checkTimeoutInterval: 60000
        });

        bot.on('spawn', () => {
          broadcast({ type: 'status', connected: true });
          broadcast({ type: 'log', text: `[Giriş] Sunucuya başarıyla girildi ve dünyaya doğuldu!`, color: '#4ade80' });

          // Anti-AFK döngüsü
          if (afkInterval) clearInterval(afkInterval);
          afkInterval = setInterval(() => {
            if (!bot || !bot.entity) return;
            
            if (data.antiAfkLook) {
              const yaw = (bot.entity.yaw + 0.3) % (Math.PI * 2);
              bot.look(yaw, bot.entity.pitch, true);
              broadcast({ type: 'log', text: `[Anti-AFK] Baş açısı çevrildi.`, color: '#94a3b8' });
            }
            if (data.antiAfkJump) {
              bot.setControlState('jump', true);
              setTimeout(() => bot.setControlState('jump', false), 400);
              broadcast({ type: 'log', text: `[Anti-AFK] Zıplama yapıldı.`, color: '#94a3b8' });
            }
            if (data.antiAfkSwing) {
              bot.swingArm('right');
              broadcast({ type: 'log', text: `[Anti-AFK] Kol sallandı (sol tık).`, color: '#94a3b8' });
            }
          }, 8000);
        });

        bot.on('chat', (username, chatMessage) => {
          broadcast({ type: 'log', text: `<${username}> ${chatMessage}`, color: '#60a5fa' });
        });

        bot.on('message', (jsonMsg) => {
          const rawText = jsonMsg.toString();
          if (rawText.trim()) {
            broadcast({ type: 'log', text: `[Sunucu] ${rawText}`, color: '#cbd5e1' });
          }
        });

        bot.on('health', () => {
          broadcast({ 
            type: 'health', 
            hp: Math.round(bot.health), 
            food: Math.round(bot.food) 
          });
        });

        bot.on('kicked', (reason) => {
          broadcast({ type: 'status', connected: false });
          broadcast({ type: 'log', text: `[Atıldı/Kick] Sebep: ${reason}`, color: '#ef4444' });
        });

        bot.on('error', (err) => {
          broadcast({ type: 'log', text: `[Hata] ${err.message}`, color: '#ef4444' });
        });

        bot.on('end', () => {
          broadcast({ type: 'status', connected: false });
          broadcast({ type: 'log', text: `[Bağlantı] Sunucu bağlantısı kapandı.`, color: '#ef4444' });
          if (afkInterval) clearInterval(afkInterval);
        });

      } else if (data.action === 'DISCONNECT') {
        if (bot) {
          bot.quit();
          bot = null;
        }
        if (afkInterval) clearInterval(afkInterval);
        broadcast({ type: 'status', connected: false });
        broadcast({ type: 'log', text: `[Kullanıcı] Bağlantı sonlandırıldı.`, color: '#f87171' });

      } else if (data.action === 'CHAT') {
        if (bot) {
          bot.chat(data.message);
          broadcast({ type: 'log', text: `[Bot]: ${data.message}`, color: '#38bdf8' });
        }
      }
    } catch(err) {
      console.error(err);
    }
  });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`AFK Motoru ve Arayüz port ${PORT} üzerinde hazır.`);
});
