import { CommandInteraction, SlashCommandBuilder } from 'discord.js';
import { logger } from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Replies with Pong!');

export async function execute(interaction: CommandInteraction): Promise<void> {
  try {
    await interaction.reply({ content: 'Pinging...' });
    const sent = await interaction.fetchReply();
    const latency = sent.createdTimestamp - interaction.createdTimestamp;

    await interaction.editReply(
      `Pong! 🏓\nLatency: ${latency}ms\nAPI Latency: ${Math.round(interaction.client.ws.ping)}ms`
    );

    logger.info(`[command] /ping executed by user:${interaction.user.id}`);
  } catch (error) {
    logger.error('Error executing /ping command:', error);
  }
}
