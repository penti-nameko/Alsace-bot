// src/commands/general/github.ts
import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel, PermissionFlagsBits } from 'discord.js';
import { prisma } from '../../utils/prisma';
// エラーメッセージに従い、型名は GitHubRepo (Hが大文字) を使用
import { GitHubRepo } from '@prisma/client';

export const data = new SlashCommandBuilder()
  .setName('github')
  .setDescription('GitHubリポジトリの管理')
  .addSubcommand(sub =>
    sub.setName('register')
      .setDescription('リポジトリを登録します')
      .addStringOption(opt => opt.setName('owner').setDescription('所有者').setRequired(true))
      .addStringOption(opt => opt.setName('repo').setDescription('リポジトリ名').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('status')
      .setDescription('登録済みリポジトリの状態を表示します')
  )
  .addSubcommand(sub =>
    sub.setName('webhook')
      .setDescription('このチャンネル用のGitHub通知URLを発行します')
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageWebhooks);

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'register') {
    const owner = interaction.options.getString('owner', true);
    const repo = interaction.options.getString('repo', true);

    try {
      await prisma.gitHubRepo.upsert({
        where: { 
          owner_repo: { owner, repo } 
        },
        update: {}, // updatedAtがない場合は空にするか、既存のフィールドを更新する
        create: { owner, repo }
      });

      await interaction.reply(`✅ ${owner}/${repo} を登録しました`);
    } catch (error) {
      console.error('GitHub command error:', error);
      await interaction.reply('❌ エラー発生。');
    }
  }

  if (subcommand === 'status') {
    try {
      const repos = await prisma.gitHubRepo.findMany();

      if (repos.length === 0) {
        return await interaction.reply('登録されているリポジトリはありません。');
      }

      const list = repos.map(r => `• ${r.owner}/${r.repo}`).join('\n');
      await interaction.reply(`【登録済みリポジトリ】\n${list}`);
    } catch (error) {
      console.error('GitHub status error:', error);
      await interaction.reply('❌取得に失敗。');
    }
  }

  if (subcommand === 'webhook') {
    const channel = interaction.channel as TextChannel;

    try {
      // 1. チャンネルに新しいWebhookを作成
      const webhook = await channel.createWebhook({
        name: 'Alsace GitHub Notification',
        avatar: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
        reason: 'GitHub Webhookコマンドによる自動生成'
      });

      // 2. Discord公式のGitHub変換用URLを作成
      const githubUrl = `${webhook.url}/github`;

      // 3. ユーザーに表示
      await interaction.reply({
        content: `📦 **GitHub通知用URLを発行しました**\n\n` +
                 `GitHubのリポジトリ設定（Webhooks > Add webhook）で以下を設定してください：\n` +
                 `・**Payload URL**: \`${githubUrl}\`\n` +
                 `・**Content type**: \`application/json\`\n\n` +
                 `⚠️ **注意**: このURLを使えばだれでも送信可能になるため、取り扱いには注意してください！`,
        ephemeral: true // 他の人に見られたくない場合は true に設定
      });

    } catch (error) {
      console.error('Webhook creation error:', error);
      await interaction.reply({ content: '❌ Webhookの作成に失敗。Botに「ウェブフックの管理」権限があるか確認してください。', ephemeral: true });
    }
  }
}