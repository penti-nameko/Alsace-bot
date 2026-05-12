import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  version as djsVersion, 
  MessageFlags 
} from 'discord.js';
import os from 'os';
import { prisma } from '../../utils/prisma';

export const data = new SlashCommandBuilder()
  .setName('info')
  .setDescription('Alsaceの情報・ステータスを表示')
  .addSubcommand(sub => sub.setName('bot').setDescription('Botの基本情報とステータス'))
  .addSubcommand(sub => sub.setName('user').setDescription('君の登録情報を表示'))
  .addSubcommand(sub => sub.setName('help').setDescription('全コマンドの使い方'));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
  const subcommand = interaction.options.getSubcommand();

  try {
    // --- BOT STATUS ---
    if (subcommand === 'bot') {
      const uptime = Math.floor(process.uptime());
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      
      // リソース計算
      const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
      const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
      const usedMem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
      const cpuLoad = os.loadavg()[0].toFixed(2);

      const embed = new EmbedBuilder()
        .setTitle('🤖 Alsace System Status')
        .setColor('#5865F2')
        .addFields(
          { name: '⏱️ Uptime', value: `${hours}h ${minutes}m`, inline: true },
          { name: '📦 Node.js', value: process.version, inline: true },
          { name: '📚 discord.js', value: `v${djsVersion}`, inline: true },
          { name: '💻 CPU Load (1m)', value: `${cpuLoad}%`, inline: true },
          { name: '🧠 RAM (Container)', value: `${usedMem} MB`, inline: true },
          { name: '🏠 OS Memory', value: `${freeMem}GB / ${totalMem}GB`, inline: true },
        )
        .setTimestamp();

      return await interaction.editReply({ embeds: [embed] });
    }

    // --- USER INFO ---
    if (subcommand === 'user') {
      const settings = await prisma.userSetting.findUnique({ 
        where: { userId: interaction.user.id },
        include: { repos: true }
      });

      const embed = new EmbedBuilder()
        .setTitle(`👤 User: ${interaction.user.username}`)
        .setThumbnail(interaction.user.displayAvatarURL())
        .setColor('#2ECC71')
        .addFields(
          { name: 'GitHub Token', value: settings?.githubToken ? '✅ 登録済み' : '❌ 未登録', inline: true },
          { name: '登録リポジトリ数', value: `${settings?.repos.length || 0} 件`, inline: true },
          { name: 'Discord ID', value: `\`${interaction.user.id}\`` }
        );

      return await interaction.editReply({ embeds: [embed] });
    }

    // --- HELP ---
    if (subcommand === 'help') {
      const embed = new EmbedBuilder()
        .setTitle('📖 Alsace Help Menu')
        .setDescription('Alsace-bot で利用可能な主要コマンドだぞ。')
        .setColor('#F1C40F')
        .addFields(
          { name: '`/task`', value: 'TODOの追加・一覧表示、GitHub Issueの作成' },
          { name: '`/github`', value: 'GitHub連携設定、リポジトリ登録、Actions起動、Webhook発行' },
          { name: '`/info bot`', value: 'Botの負荷状況やOS情報の確認' },
          { name: '`/info user`', value: '自分のトークン登録状況の確認' }
        )
        .setFooter({ text: '詳細な使い方は各コマンドのオプションを見てくれ！' });

      return await interaction.editReply({ embeds: [embed] });
    }

  } catch (error: any) {
    console.error('Info Command Error:', error);
    return await interaction.editReply(`❌ ステータス取得に失敗したぞ：${error.message}`);
  }
}