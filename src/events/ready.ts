import { Events, Client } from 'discord.js';
import { logger } from '../utils/logger';

export const name = Events.ClientReady;
export const once = true;

export async function execute(client: Client) {
  if (!client.user) return;
  logger.info(`✅ Ready! Logged in as ${client.user.tag}`);
}