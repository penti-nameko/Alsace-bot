import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { prisma } from '../../utils/prisma';
import { Octokit } from '@octokit/rest'; 
import { decrypt } from '../../utils/crypto';

export const data = new SlashCommandBuilder()
  .setName('task')
  .setDescription('TODO & Issue 管理')
  .addSubcommand(sub =>
    sub.setName('add').setDescription('TODOを追加')
      .addStringOption(opt => opt.setName('content').setDescription('内容').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('list').setDescription('TODO一覧を表示')
  )
  .addSubcommand(sub =>
    sub.setName('issue').setDescription('GitHub Issueを作成')
      .addStringOption(opt => opt.setName('repo').setDescription('リポジトリ名 (owner/repo)').setRequired(true))
      .addStringOption(opt => opt.setName('title').setDescription('タイトル').setRequired(true))
  );
export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

  try {
    // --- ADD: ここを省略せずに書く ---
    if (subcommand === 'add') {
      const content = interaction.options.getString('content', true);
      await prisma.todo.create({
        data: {
          userId: interaction.user.id,
          content: content,
        }
      });
      return await interaction.editReply(`✅ TODOを追加したぞ：${content}`);
    }

    // --- LIST: ここも省略せずに書く ---
    if (subcommand === 'list') {
      const todos = await prisma.todo.findMany({
        where: { userId: interaction.user.id, completed: false }
      });

      if (todos.length === 0) {
        return await interaction.editReply('📝 TODOは空っぽだ。');
      }

      const list = todos.map((t, i) => `${i + 1}. ${t.content}`).join('\n');
      return await interaction.editReply(`【現在のTODO】\n${list}`);
    }

    // --- ISSUE ---
    if (subcommand === 'issue') {
      // ...（送ってくれた GitHub Issue のロジック）...
      // 最後に必ず return await interaction.editReply(...) があることを確認
    }

    // 💡 万が一、どのサブコマンドにも該当しなかった場合
    return await interaction.editReply('不明なサブコマンドだ。');

  } catch (error: any) {
    console.error('Task Error:', error);
    // deferしているので、reply ではなく editReply を使う
    return await interaction.editReply(`❌ エラーが発生したぞ: ${error.message}`);
  }
}