import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { prisma } from '../../utils/prisma';

export const data = new SlashCommandBuilder()
  .setName('afk')
  .setDescription('離席中モードの設定')
  .addStringOption(opt => opt.setName('reason').setDescription('理由（オプション）'));

export async function execute(interaction: ChatInputCommandInteraction) {
  const reason = interaction.options.getString('reason') || 'AFK (離席中)';
  
  await prisma.afk.upsert({
    where: { userId: interaction.user.id },
    update: { reason },
    create: { userId: interaction.user.id, reason }
  });

  return interaction.reply({ content: `💤 AFKモードを有効にしました: **${reason}**\n次に発言すると自動解除されます。`, ephemeral: true });
}