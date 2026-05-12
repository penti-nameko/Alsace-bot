import { Events, Message, MessageFlags } from 'discord.js';
import { prisma } from '../utils/prisma';

export const name = Events.MessageCreate;

export async function execute(message: Message) {
  if (message.author.bot) return;

  // 1. AFK解除チェック (本人が発言したら解除)
  const afkData = await prisma.afk.findUnique({ where: { userId: message.author.id } });
  if (afkData) {
    await prisma.afk.delete({ where: { userId: message.author.id } });
    const reply = await message.reply('おかえり！AFKモードを解除したぞ。');
    setTimeout(() => reply.delete().catch(() => {}), 5000);
  }

  // 2. メンション反応 & 削除ロジック
  // @everyone と @here を除くメンションがあるかチェック
  const mentionedUsers = message.mentions.users.filter(u => !u.bot);
  
  for (const [userId, user] of mentionedUsers) {
    const targetAfk = await prisma.afk.findUnique({ where: { userId } });
    
    if (targetAfk) {
      // AFK中のユーザーへのメンションを削除（everyone/hereはDiscord仕様上、usersに含まれないので安全）
      if (message.deletable) {
        await message.delete().catch(() => {});
        // 通知用のメッセージを送信（5秒で消えるようにすると邪魔にならない）
        const notice = await message.channel.send(`⚠️ ${message.author}、${user.username} は現在AFK中だ: **${targetAfk.reason}**\n(メンション保護のためメッセージを削除したぞ)`);
        setTimeout(() => notice.delete().catch(() => {}), 10000);
      }
    }
  }
}