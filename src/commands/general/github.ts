// src/commands/general/github.ts
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
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
  );

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

      await interaction.reply(`✅ ${owner}/${repo} を登録したぞ！`);
    } catch (error) {
      console.error('GitHub command error:', error);
      await interaction.reply('❌ 登録中にエラーが発生した。');
    }
  }

  if (subcommand === 'status') {
    try {
      const repos = await prisma.gitHubRepo.findMany();

      if (repos.length === 0) {
        return await interaction.reply('登録されているリポジトリはないぞ。');
      }

      const list = repos.map(r => `• ${r.owner}/${r.repo}`).join('\n');
      await interaction.reply(`【登録済みリポジトリ】\n${list}`);
    } catch (error) {
      console.error('GitHub status error:', error);
      await interaction.reply('❌ 状態の取得に失敗した。');
    }
  }
}