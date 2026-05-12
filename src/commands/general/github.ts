// src/commands/general/github.ts
import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  TextChannel, 
  PermissionFlagsBits, 
  EmbedBuilder, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  ActionRowBuilder, 
  ModalActionRowComponentBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  MessageFlags
} from 'discord.js';
import { prisma } from '../../utils/prisma';
import { decrypt } from '../../utils/crypto';
import { Octokit } from '@octokit/rest';
import axios from 'axios';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

export const data = new SlashCommandBuilder()
  .setName('github')
  .setDescription('GitHub & Docker 連携')
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
  .addSubcommand(sub =>
    sub.setName('setup')
      .setDescription('GitHub個人トークンを設定します（Action手動起動用）')
  )
  .addSubcommand(sub =>
    sub.setName('dispatch')
      .setDescription('GitHub Actionsのワークフローを手動起動します')
      .addStringOption(opt => opt.setName('owner').setDescription('所有者').setRequired(true))
      .addStringOption(opt => opt.setName('repo').setDescription('リポジトリ名').setRequired(true))
      .addStringOption(opt => opt.setName('workflow').setDescription('ファイル名 (例: build.yml)').setRequired(true))
      .addStringOption(opt => opt.setName('ref').setDescription('ブランチ名').setRequired(false))
  )
  .addSubcommand(sub =>
    sub.setName('docker')
      .setDescription('Docker Hubのイメージを検索します')
      .addStringOption(opt => opt.setName('query').setDescription('検索ワード').setRequired(true))
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageWebhooks);

// ユーザー個別の Octokit を生成するユーティリティ
async function getOctokitForUser(userId: string) {
  const setting = await prisma.userSetting.findUnique({ where: { userId } });
  if (!setting?.githubToken) {
    throw new Error("GitHubトークンが登録されていないぞ。`/github setup` を先にやってくれ。");
  }
  const decryptedToken = decrypt(setting.githubToken);
  return new Octokit({ auth: decryptedToken });
}

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'register') {
      const owner = interaction.options.getString('owner', true);
      const repo = interaction.options.getString('repo', true);

      await prisma.gitHubRepo.upsert({
        where: { 
          owner_repo: { owner, repo } 
        },
        update: {}, // updatedAtがない場合は空にするか、既存のフィールドを更新する
        create: { owner, repo }
      });

      return await interaction.reply(`✅ ${owner}/${repo} を登録しました`);
    }

    if (subcommand === 'status') {
      const repos = await prisma.gitHubRepo.findMany();
      if (repos.length === 0) {
        return await interaction.reply('登録されているリポジトリはありません。');
      }
      const list = repos.map((r: any) => `• ${r.owner}/${r.repo}`).join('\n');
      return await interaction.reply(`【登録済みリポジトリ】\n${list}`);
    }

    if (subcommand === 'webhook') {
      const channel = interaction.channel as TextChannel;
      // 1. チャンネルに新しいWebhookを作成
      const webhook = await channel.createWebhook({
        name: 'Alsace GitHub Notification',
        avatar: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
        reason: 'GitHub Webhookコマンドによる自動生成'
      });
      // 2. Discord公式のGitHub変換用URLを作成
      const githubUrl = `${webhook.url}/github`;
      // 3. ユーザーに表示
      return await interaction.reply({
        content: `📦 **GitHub通知用URLを発行しました**\n\n` +
                 `GitHubのリポジトリ設定（Webhooks > Add webhook）で以下を設定してください：\n` +
                 `・**Payload URL**: \`${githubUrl}\`\n` +
                 `・**Content type**: \`application/json\`\n\n` +
                 `⚠️ **注意**: このURLを使えばだれでも送信可能になるため、取り扱いには注意してください！`,
        flags: [MessageFlags.Ephemeral]
      });
    }

    // --- GitHub Setup (Token storage) ---
    if (subcommand === 'setup') {
      return await interaction.reply({
        content: '🔒 **個人設定を開始するぞ。**\n下のボタンを押してくれ。',
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId('open-setup-modal')
              .setLabel('設定画面を開く')
              .setStyle(ButtonStyle.Primary)
          )
        ],
        flags: [MessageFlags.Ephemeral]
      });
    }

    // --- GitHub Actions Dispatch ---
    if (subcommand === 'dispatch') {
      await interaction.deferReply();
      const owner = interaction.options.getString('owner', true);
      const repo = interaction.options.getString('repo', true);
      const workflow_id = interaction.options.getString('workflow', true);
      const ref = interaction.options.getString('ref') || 'main';

      const userOctokit = await getOctokitForUser(interaction.user.id);
      await userOctokit.actions.createWorkflowDispatch({
        owner, repo, workflow_id, ref
      });
      return await interaction.editReply(`🚀 君のトークンを使って **${owner}/${repo}** のワークフロー \`${workflow_id}\` を起動したぞ！`);
    }

    // --- Docker Hub Search ---
    if (subcommand === 'docker') {
      await interaction.deferReply();
      const query = interaction.options.getString('query', true);
      const res = await axios.get(`https://hub.docker.com/v2/search/repositories/?query=${query}`);
      const results = res.data.results.slice(0, 5); // 上位5件
      if (results.length === 0) return await interaction.editReply('イメージが見つからなかった。');
      const embed = new EmbedBuilder()
        .setTitle(`🐳 Docker Hub 検索結果: ${query}`)
        .setColor('#2496ed')
        .setTimestamp();
      results.forEach((r: any) => {
        embed.addFields({
          name: r.repo_name,
          value: `⭐ ${r.star_count} | 📥 ${r.pull_count}\n${r.short_description || '説明なし'}`,
          inline: false
        });
      });
      return await interaction.editReply({ embeds: [embed] });
    }

  } catch (error) {
    console.error('github command error:', error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: '実行中にエラーが発生したぞ。', flags: [MessageFlags.Ephemeral] });
    } else {
      await interaction.reply({ content: '実行中にエラーが発生したぞ。', flags: [MessageFlags.Ephemeral] });
    }
  }
}