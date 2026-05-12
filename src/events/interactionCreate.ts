import { 
  Events, 
  Interaction, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  ActionRowBuilder, 
  ModalActionRowComponentBuilder,
  MessageFlags
} from 'discord.js';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';
import { encrypt } from '../utils/crypto';

export const name = Events.InteractionCreate;

export async function execute(interaction: Interaction) {
  // --- 1. スラッシュコマンドの実行 ---
  if (interaction.isChatInputCommand()) {
    const client: any = interaction.client;
    const command = client.commands.get(interaction.commandName);

    if (!command) {
      logger.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      logger.error(`Error executing ${interaction.commandName}`);
      logger.error(error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'コマンド実行中にエラーが発生しました。', flags: [MessageFlags.Ephemeral] });
      }
    }
  }

  // --- 1.5. コンテキストメニュー（ユーザー/メッセージ）の実行 ---
  if (interaction.isContextMenuCommand()) {
    const client: any = interaction.client;
    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      logger.error(`Error executing context menu ${interaction.commandName}`);
      logger.error(error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'コマンド実行中にエラーが発生しました。', flags: [MessageFlags.Ephemeral] });
      }
    }
  }

  // --- 2. ボタンのクリックを検知 ---
  if (interaction.isButton()) {
    if (interaction.customId === 'open-setup-modal') {
      const modal = new ModalBuilder()
        .setCustomId('general-setup-modal')
        .setTitle(' Alsace-bot 外部連携設定');

      const ghToken = new TextInputBuilder()
        .setCustomId('gh-token').setLabel("GitHub Token (PAT)").setStyle(TextInputStyle.Short).setRequired(true);

      const hHost = new TextInputBuilder()
      // 各入力をRowに変換して追加
      modal.addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(ghToken),
      );

      try {
        await interaction.showModal(modal);
      } catch (e) {
        console.error('モーダル表示エラー:', e);
      }
    }
  }

  // --- 2.7. セレクトメニューの操作を検知 ---
  if (interaction.isStringSelectMenu()) {
    // customIdからコマンド名を抽出する (例: 'github-unregister-select' -> 'github')
    const commandName = interaction.customId.split('-')[0];
    const client: any = interaction.client;
    const command = client.commands.get(commandName);

    if (!command) return;

    try {
      if (command.executeSelectMenu) {
        await command.executeSelectMenu(interaction);
      }
    } catch (error) {
      logger.error(`Error executing select menu for ${interaction.customId}`);
      logger.error(error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'メニュー選択の処理中にエラーが発生しました。', flags: [MessageFlags.Ephemeral] });
      }
    }
  }

  // --- 2.5. オートコンプリート（入力補完）の実行 ---
  if (interaction.isAutocomplete()) {
    const client: any = interaction.client;
    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    try {
      await command.autocomplete(interaction);
    } catch (error) {
      logger.error(`Error executing autocomplete for ${interaction.commandName}`);
      logger.error(error);
    }
  }

  // --- 3. モーダルの送信を検知 ---
  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'general-setup-modal') {
      // 先に応答を保留する（3秒ルール対策）
      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

      try {
        const token = interaction.fields.getTextInputValue('gh-token');
        
        if (!token) {
          throw new Error("トークンが入力されていません。");
        }

        const encryptedToken = encrypt(token);

        // DB保存
        await prisma.userSetting.upsert({
          where: { userId: interaction.user.id },
          update: { 
            githubToken: encryptedToken,
          },
          create: { 
            userId: interaction.user.id, 
            githubToken: encryptedToken,
          }
        });

        await interaction.editReply({ 
          content: '✅ 外部連携設定を暗号化して保存しました！' 
        });

      } catch (error: any) {
        logger.error('Failed to save settings:', error);
        // deferReply 済みなので必ず editReply を使う
        if (interaction.deferred) {
          await interaction.editReply({ 
            content: `❌ 保存中にエラーが発生しました：${error.message}` 
          }).catch(() => {});
        }
      }
    }
  }
}