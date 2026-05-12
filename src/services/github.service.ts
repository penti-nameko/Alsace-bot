import { Octokit } from '@octokit/rest';
import { StringSelectMenuOptionBuilder } from 'discord.js';

export async function fetchUserRepos(token: string): Promise<StringSelectMenuOptionBuilder[]> {
  const octokit = new Octokit({ auth: token });
  
  // 自分が所有している、または書き込み権限があるリポジトリを取得
  const { data } = await octokit.repos.listForAuthenticatedUser({
    visibility: 'all',
    affiliation: 'owner,collaborator',
    sort: 'updated',
    per_page: 25 // 最初は直近25件くらいが選びやすい
  });

  return data.map(repo => new StringSelectMenuOptionBuilder()
    .setLabel(repo.full_name)
    .setValue(repo.full_name)
    .setDescription(repo.private ? '🔒 Private' : '🌐 Public'));
}