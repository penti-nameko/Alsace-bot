#!/bin/bash

# ディレクトリ作成
mkdir -p src/commands/admin src/commands/general src/events src/services src/utils src/config src/middlewares src/api prisma scripts tests

# 空のファイル作成
touch src/commands/index.ts src/events/ready.ts src/events/interactionCreate.ts src/events/guildMemberAdd.ts
touch src/services/github.service.ts src/services/kubernetes.service.ts src/services/proxmox.service.ts
touch src/utils/env.ts src/utils/error.ts
touch src/config/commands.ts src/config/constants.ts
touch src/middlewares/permission.ts
touch src/api/webhook.ts
touch prisma/schema.prisma
touch scripts/deploy-commands.ts scripts/healthcheck.ts
touch .env .eslintrc.js .prettierrc Dockerfile docker-compose.yml

# 1. logger.ts の生成 [cite: 6]
cat <<EOT > src/utils/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});
EOT

# 2. bot.ts の生成 [cite: 6]
cat <<EOT > src/bot.ts
import { Client, Collection, GatewayIntentBits } from 'discord.js';
import { logger } from './utils/logger';

export class DiscordBot extends Client {
  public commands: Collection<string, any> = new Collection();

  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
      ],
    });
  }

  public async start(token: string): Promise<void> {
    try {
      await this.login(token);
      logger.info('Bot has been logged in successfully.');
    } catch (error) {
      logger.error('Failed to login to Discord:', error);
      process.exit(1);
    }
  }
}
EOT

# 3. index.ts の生成 [cite: 6]
cat <<EOT > src/index.ts
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
EOT

# 4. ping.ts の生成 [cite: 6]
cat <<EOT > src/commands/general/ping.ts
import { CommandInteraction, SlashCommandBuilder } from 'discord.js';
import { logger } from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Replies with Pong!');

export async function execute(interaction: CommandInteraction): Promise<void> {
  try {
    const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;

    await interaction.editReply(
      \`Pong! 🏓\nLatency: \${latency}ms\nAPI Latency: \${Math.round(interaction.client.ws.ping)}ms\`
    );

    logger.info(\`[command] /ping executed by user:\${interaction.user.id}\`);
  } catch (error) {
    logger.error('Error executing /ping command:', error);
  }
}
EOT

echo "✅ Project structure and core files have been generated!"