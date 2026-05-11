import { logger } from '../utils/logger';

export interface gitHubRepoInfo {
  name: string;
  description: string;
  stars: number;
  forks: number;
  url: string;
}

export class GitHubService {
  private readonly baseUrl = 'https://api.github.com';

  /**
   * レポジトリの基本情報を取得する
   */
  public async getRepoInfo(owner: string, repo: string): Promise<gitHubRepoInfo | null> {
    try {
      const headers: HeadersInit = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Alsace-bot' // GitHub APIはUser-Agentが必須
      };

      // .envにトークンがあれば認証ヘッダーを追加
      if (process.env.GITHUB_TOKEN) {
        headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
      }

      const response = await fetch(`${this.baseUrl}/repos/${owner}/${repo}`, {
        headers
      });

      if (!response.ok) {
        // レート制限エラーなどの詳細をログに出す
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorBody.message}`);
      }

      const data = await response.json();

      return {
        name: data.full_name,
        description: data.description,
        stars: data.stargazers_count,
        forks: data.forks_count,
        url: data.html_url,
      };
    } catch (error) {
      logger.error('Failed to fetch GitHub repo info:', error);
      return null;
    }
  }
}