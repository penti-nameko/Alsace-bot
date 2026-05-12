import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  TextChannel, 
  PermissionFlagsBits, 
  EmbedBuilder, 
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  MessageFlags,
} from 'discord.js';

import { fetchUserRepos } from '../../services/github.service';
import { prisma } from '../../utils/prisma';
import { decrypt } from '../../utils/crypto';
import { Octokit } from '@octokit/rest';
import axios from 'axios';

export const data = new SlashCommandBuilder()
  .setName('github')
  .setDescription('GitHub & Container Registry 連携')
  // --- 設定系 ---
  .addSubcommand(sub =>
    sub.setName('setup').setDescription('GitHub / Harbor の連携設定（トークン登録）')
  )
  // --- リポジトリ管理 ---
  .addSubcommand(sub =>
    sub.setName('add').setDescription('GitHubからリポジトリを選択してBotに登録します')
  )
  .addSubcommand(sub =>
    sub.setName('list').setDescription('登録済みリポジトリの一覧を表示・解除します')
  )
  // --- 通知・操作 ---
  .addSubcommand(sub =>
    sub.setName('webhook').setDescription('このチャンネル用のGitHub通知URLを発行します')
  )
  .addSubcommand(sub =>
    sub.setName('dispatch')
      .setDescription('Actionsを手動起動します')
      .addStringOption(opt => opt.setName('repo').setDescription('リポジトリ名 (owner/repo)').setRequired(true))
      .addStringOption(opt => opt.setName('workflow').setDescription('ファイル名 (build.yml)').setRequired(true))
  )
  // --- 検索 ---
  .addSubcommand(sub =>
    sub.setName('docker').setDescription('Docker Hub イメージ検索')
      .addStringOption(opt => opt.setName('query').setDescription('検索ワード').setRequired(true))
  )
  
  // --- 検索 ---
  .addSubcommand(sub =>
    sub.setName('ghcr').setDescription('GHCR コンテナイメージ検索')
      .addStringOption(opt => opt.setName('query').setDescription('検索ワード').setRequired(true))
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageWebhooks);

export async function execute(interaction: ChatInputCommandInteraction) {
  // ⚡ 3秒ルール回避のため、何よりも先に defer
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

  try {
    const subcommand = interaction.options.getSubcommand();

    // --- SETUP: 以前のボタン出し処理 ---
    if (subcommand === 'setup') {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('open-setup-modal')
          .setLabel('設定画面を開く (GitHub/Harbor)')
          .setStyle(ButtonStyle.Primary)
      );
      return await interaction.editReply({
        content: '🔒 **外部サービス連携設定**\n下のボタンからトークンや接続情報を登録してくれ。',
        components: [row]
      });
    }

    // --- ADD: セレクトメニューでリポジトリ登録 ---
    if (subcommand === 'add') {
      const settings = await prisma.userSetting.findUnique({ where: { userId: interaction.user.id } });
      if (!settings?.githubToken) return await interaction.editReply('先に `/github setup` を完了させてくれ！');

      const repoOptions = await fetchUserRepos(decrypt(settings.githubToken));
      if (repoOptions.length === 0) return await interaction.editReply('アクセス可能なリポジトリが見つからなかった。');

      const select = new StringSelectMenuBuilder()
        .setCustomId('github-register-select')
        .setPlaceholder('Botに登録するリポジトリを選んでくれ')
        .addOptions(repoOptions.slice(0, 25)); // Discord制限: 最大25件

      return await interaction.editReply({
        content: '君がアクセスできるリポジトリ（Private含む）を見つけてきたぞ！',
        components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)]
      });
    }

    // --- LIST: 登録済みレポの表示と解除ボタン ---
if (subcommand === 'list') {
      const repos = await prisma.gitHubRepo.findMany({ 
        where: { userId: interaction.user.id } 
      });

      if (repos.length === 0) {
        return await interaction.editReply('登録されているリポジトリはないぞ。');
      }

      // 💡 ここが重要！ メッセージとして表示するリストを作る
      const repoListString = repos.map(r => `• **${r.owner}/${r.repo}**`).join('\n');

      // 解除用のセレクトメニュー
      const select = new StringSelectMenuBuilder()
        .setCustomId('github-unregister-select')
        .setPlaceholder('登録を解除するリポジトリを選択')
        .addOptions(repos.map(r => ({ 
          label: `${r.owner}/${r.repo}`, 
          value: `${r.owner}/${r.repo}` 
        })));

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

      // 💡 content に repoListString を含めて返信！
      return await interaction.editReply({
        content: `【登録済みリポジトリ一覧】\n${repoListString}\n\n🗑️ **解除したい場合は下のメニューから選んでくれ：**`,
        components: [row]
      });
    }

    // --- DISPATCH: 手動起動 ---
    if (subcommand === 'dispatch') {
      const fullRepo = interaction.options.getString('repo', true);
      const [owner, repo] = fullRepo.split('/');
      const workflow_id = interaction.options.getString('workflow', true);

      const settings = await prisma.userSetting.findUnique({ where: { userId: interaction.user.id } });
      if (!settings?.githubToken) return await interaction.editReply('トークンがないぞ。');

      const octokit = new Octokit({ auth: decrypt(settings.githubToken) });
      await octokit.actions.createWorkflowDispatch({ owner, repo, workflow_id, ref: 'main' });

      return await interaction.editReply(`🚀 **${fullRepo}** の \`${workflow_id}\` を起動したぞ！`);
    }

    // --- WEBHOOK & DOCKER (既存ロジック維持) ---
    if (subcommand === 'webhook') {
      const channel = interaction.channel as TextChannel;
      const webhook = await channel.createWebhook({ name: 'Alsace GitHub', reason: 'Command' });
      return await interaction.editReply(`📦 **通知URL:** \`${webhook.url}/github\``);
    }

    if (subcommand === 'docker') {
      const query = interaction.options.getString('query', true);
      const res = await axios.get(`https://hub.docker.com/v2/search/repositories/?query=${query}`);
      const embed = new EmbedBuilder().setTitle(`🐳 Docker Hub: ${query}`).setColor('#2496ed');
      res.data.results.slice(0, 5).forEach((r: any) => {
        embed.addFields({ name: r.repo_name, value: `⭐ ${r.star_count} | ${r.short_description || 'No description'}` });
      });
      return await interaction.editReply({ embeds: [embed] });
    }

// --- GHCR: パッケージ一覧表示 ---
    if (subcommand === 'ghcr') {
      const settings = await prisma.userSetting.findUnique({ where: { userId: interaction.user.id } });
      if (!settings?.githubToken) return await interaction.editReply('先に `/github setup` をしてくれ！');

      const octokit = new Octokit({ auth: decrypt(settings.githubToken) });

      // GHCRのパッケージを取得
      const { data: packages } = await octokit.rest.packages.listPackagesForAuthenticatedUser({
        package_type: 'container',
      });

      if (packages.length === 0) return await interaction.editReply('GHCRにコンテナが見つからなかった。');

      const embed = new EmbedBuilder()
        .setTitle('📦 GHCR Container Packages')
        .setColor('#24292e')
        .setTimestamp();

      packages.slice(0, 10).forEach(pkg => {
        embed.addFields({ 
          name: pkg.name, 
          value: `🔗 [View on GitHub](${pkg.html_url})\nVisibility: \`${pkg.visibility}\`` 
        });
      });

      return await interaction.editReply({ embeds: [embed] });
    }

    
  } catch (error: any) {
    console.error('github error:', error);
    await interaction.editReply(`❌ エラー: ${error.message}`).catch(() => {});
  }
}
export async function executeSelectMenu(interaction: any) {
  // セレクトメニューも3秒制限が厳しいので即座に保留
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

  const [owner, repo] = interaction.values[0].split('/');

  try {
    console.log(`[DEBUG] Registering: ${owner}/${repo} for ID: ${interaction.user.id}`);
    if (interaction.customId === 'github-register-select') {
      await prisma.gitHubRepo.upsert({
        where: { userId_owner_repo: { userId: interaction.user.id, owner, repo } },
        update: {},
        create: { userId: interaction.user.id, owner, repo }
      });
      return await interaction.editReply(`✅ **${owner}/${repo}** を登録したぞ！`);
            
    }

    if (interaction.customId === 'github-unregister-select') {
      await prisma.gitHubRepo.deleteMany({
        where: { userId: interaction.user.id, owner, repo }
      });
      return await interaction.editReply(`🗑️ **${owner}/${repo}** の登録を解除したぞ。`);
    }
  } catch (error) {
    console.error('SelectMenu Error:', error);
    return await interaction.editReply('❌ 処理中にエラーが発生したぞ。DB接続を確認してくれ。');
  }
}