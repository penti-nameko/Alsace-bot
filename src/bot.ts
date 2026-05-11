import { Client, Collection, GatewayIntentBits } from 'discord.js';
import { logger } from './utils/logger';
import fs from 'fs';
import path from 'path';

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

  // イベント読み込み
  public async loadEvents(): Promise<void> {
    const eventsPath = path.join(__dirname, 'events');
    if (!fs.existsSync(eventsPath)) return;

    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.ts'));

    for (const file of eventFiles) {
      const filePath = path.join(eventsPath, file);
      const module = await import(filePath);
      const event = (module.default && (module.default.name || module.default.execute)) 
        ? module.default 
        : module;
      
      if (!event.name || !event.execute) continue;

      if (event.once) {
        this.once(event.name, (...args) => event.execute(...args));
      } else {
        this.on(event.name, (...args) => event.execute(...args));
      }
      logger.info(`Loaded event: ${event.name}`);
    }
  }

  // コマンド読み込み
  public async loadCommands(): Promise<void> {
  const commandsPath = path.join(__dirname, 'commands');
  if (!fs.existsSync(commandsPath)) return;

  const commandFolders = fs.readdirSync(commandsPath).filter(f => 
    fs.statSync(path.join(commandsPath, f)).isDirectory()
  );

  for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.ts'));

    for (const file of commandFiles) {
      const filePath = path.join(folderPath, file);
      // module の中身を直接デバッグ用にログ出ししてもいい
      const commandModule = await import(filePath);
      
      // 名前付きエクスポート(export const data) と デフォルトエクスポート(export default) の両方に対応
      const command = commandModule.data ? commandModule : commandModule.default;
      
      if (command && command.data && command.execute) {
        this.commands.set(command.data.name, command);
        logger.info(`Loaded command: ${command.data.name}`);
      } else {
        logger.warn(`Skipped command file ${file}: Missing "data" or "execute" export.`);
      }
    }
  }
}

  public async start(token: string): Promise<void> {
    try {
      await this.loadEvents();
      await this.loadCommands();
      await this.login(token);
      logger.info('Bot has been logged in successfully.');
    } catch (error) {
      logger.error('Failed to login to Discord:', error);
      process.exit(1);
    }
  }
}
