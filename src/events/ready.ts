import { Events, Client, ActivityType } from 'discord.js';
import { logger } from '../utils/logger';
import os from 'os';

export const name = Events.ClientReady;
export const once = true;

export async function execute(client: Client) {
  if (!client.user) return;
  logger.info(`✅ Ready! Logged in as ${client.user.tag}`);

  // アクティビティに表示する情報のリスト
  const statusList = [
    () => ` ${client.guilds.cache.size} サーバー`,
    () => ` /info help`,
    () => {
      const uptime = Math.floor(process.uptime());
      const h = Math.floor(uptime / 3600);
      const m = Math.floor((uptime % 3600) / 60);
      return ` ${h}h ${m}m`;
    },
    () => ` Ping: ${Math.round(client.ws.ping)}ms`,
    () => {
      const usedMem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
      return ` RAM: ${usedMem}MB`;
    },
    () => ` CPU: ${os.loadavg()[0].toFixed(2)}%`
  ];

  let i = 0;
  // 15秒ごとにステータスを更新
  setInterval(() => {
    if (client.user) {
      client.user.setActivity(statusList[i](), { type: ActivityType.Custom });
      i = (i + 1) % statusList.length;
    }
  }, 15000);
}