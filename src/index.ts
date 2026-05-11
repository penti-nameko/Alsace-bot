import dotenv from 'dotenv';
import { DiscordBot } from './bot';
import { logger } from './utils/logger';

dotenv.config();

const token = process.env.DISCORD_TOKEN;

if (!token) {
  logger.error('DISCORD_TOKEN is missing in environment variables.');
  process.exit(1);
}

const bot = new DiscordBot();

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down...');
  bot.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received (K8s pod termination). Cleaning up...');
  bot.destroy();
  process.exit(0);
});

bot.start(token);
