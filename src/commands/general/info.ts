import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  version as djsVersion
} from 'discord.js';
import os from 'os';
import { prisma } from '../../utils/prisma';

export const data = new SlashCommandBuilder()
  .setName('info')
  .setDescription('Alsaceの情報・ステータスを表示')
  .addSubcommand(sub => sub.setName('bot').setDescription('Botの基本情報とステータス'))
  .addSubcommand(sub => 
    sub.setName('user').setDescription('ユーザーの登録情報を表示')
      .addUserOption(opt => opt.setName('target').setDescription('情報を確認したいユーザー'))
  )
  .addSubcommand(sub => sub.setName('help').setDescription('全コマンドの使い方'));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
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
      
      // Discord ステータス
      const apiPing = Math.round(interaction.client.ws.ping);
      const serverCount = interaction.client.guilds.cache.size;

      const embed = new EmbedBuilder()
        .setTitle('🤖 Alsace System Status')
        .setColor('#5865F2')
        .addFields(
          { name: '⏱️ Uptime', value: `${hours}h ${minutes}m`, inline: true },
          { name: '📶 API Latency', value: `${apiPing}ms`, inline: true },
          { name: '🏰 導入サーバー', value: `${serverCount} サーバー`, inline: true },
          { name: ' Node.js', value: process.version, inline: true },
          { name: '📚 discord.js', value: `v${djsVersion}`, inline: true },
          { name: '💻 CPU Load (1m)', value: `${cpuLoad}%`, inline: true },
          { name: '🧠 RAM (Used)', value: `${usedMem} MB`, inline: true },
          { name: '🏠 OS Memory', value: `${freeMem}GB / ${totalMem}GB`, inline: true },
        )
        .setTimestamp();

      return await interaction.editReply({ embeds: [embed] });
    }

    // --- USER INFO ---
    if (subcommand === 'user') {
      const targetUser = interaction.options.getUser('target') || interaction.user;
      const settings = await prisma.userSetting.findUnique({ 
        where: { userId: targetUser.id },
        include: { repos: true }
      });

      const embed = new EmbedBuilder()
        .setTitle(`👤 User: ${targetUser.username}`)
        .setThumbnail(targetUser.displayAvatarURL())
        .setColor('#2ECC71')
        .addFields(
          { name: 'アカウント作成日', value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:D>`, inline: true },
          { name: 'Discord ID', value: `\`${targetUser.id}\``, inline: true },
          { name: '登録リポジトリ数', value: `${settings?.repos.length || 0} 件`, inline: true }
        );

      return await interaction.editReply({ embeds: [embed] });
    }

    // --- HELP ---
    if (subcommand === 'help') {
      const embed = new EmbedBuilder()
        .setTitle('📖 Alsace Help Menu')
        .setDescription('Alsace-bot で利用可能な主要コマンドです。')
        .setColor('#F1C40F')
        .addFields(
          { name: '`/todo`', value: 'TODOの追加・一覧表示、GitHub Issueの作成' },
          { name: '`/github`', value: 'GitHub連携設定、リポジトリ登録、Actions起動、Webhook発行' },
          { name: '`/info bot`', value: 'Botの負荷状況やOS情報の確認' },
          { name: '`/info user`', value: 'ユーザーの基本情報とBotの利用状況を確認' }
        )
        .setFooter({ text: '詳細な使い方は各コマンドのオプションを確認してください。' });

      return await interaction.editReply({ embeds: [embed] });
    }

  } catch (error: any) {
    console.error('Info Command Error:', error);
    return await interaction.editReply(`❌ ステータスの取得に失敗しました：${error.message}`);
  }
}