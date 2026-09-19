import type {
  TechhubConfig,
  TechhubInteraction,
  TechhubPost,
  TechhubPostDeleteResult,
} from "@/services/techhub/types";

export class TechhubSupabaseClient {
  private readonly restUrl: string;

  constructor(private readonly config: TechhubConfig) {
    this.restUrl = `${config.url.replace(/\/$/, "")}/rest/v1`;
  }

  private getHeaders(prefer = "return=representation"): Record<string, string> {
    return {
      apikey: this.config.anonKey,
      Authorization: `Bearer ${this.config.anonKey}`,
      "Content-Type": "application/json",
      Prefer: prefer,
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      const url = `${this.restUrl}/${this.config.usersTable}?limit=1`;
      const response = await fetch(url, {
        method: "GET",
        headers: this.getHeaders(),
        cache: "no-store",
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async getPostByTechhubId(techhubId: number): Promise<TechhubPost | null> {
    const url = `${this.restUrl}/posts?techhub_id=eq.${techhubId}&limit=1`;
    const response = await fetch(url, {
      method: "GET",
      headers: this.getHeaders(),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch post: ${response.status}`);
    }

    const data = (await response.json()) as TechhubPost[];
    return data.length > 0 ? data[0] : null;
  }

  async getUltraPosts(): Promise<TechhubPost[]> {
    const pageSize = 1000;
    const posts: TechhubPost[] = [];

    for (let offset = 0; ; offset += pageSize) {
      const url =
        `${this.restUrl}/posts?is_ultra=eq.true&status=eq.open&published_at=is.null` +
        "&select=id,title,status,techhub_id,techhub_uuid,username,url,votes_score,comments_count,feed_score,is_ultra,is_blacklisted,created_at,published_at" +
        "&order=created_at.desc" +
        `&limit=${pageSize}&offset=${offset}`;
      const response = await fetch(url, {
        method: "GET",
        headers: this.getHeaders(),
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch ultra posts: ${response.status}`);
      }

      const page = (await response.json()) as TechhubPost[];
      posts.push(...page);
      if (page.length < pageSize) break;
    }

    return posts;
  }

  async getRecentUnpublishedPostsByUsername(
    username: string,
    limit = 20,
  ): Promise<TechhubPost[]> {
    const normalizedUsername = username.trim().toLowerCase();
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 20);
    const url =
      `${this.restUrl}/posts?username=eq.${encodeURIComponent(normalizedUsername)}` +
      "&status=eq.open&published_at=is.null" +
      "&select=id,title,status,techhub_id,techhub_uuid,username,url,votes_score,comments_count,feed_score,is_ultra,is_blacklisted,created_at,published_at" +
      "&order=created_at.desc" +
      `&limit=${safeLimit}`;
    const response = await fetch(url, {
      method: "GET",
      headers: this.getHeaders(),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch user posts: ${response.status}`);
    }

    return (await response.json()) as TechhubPost[];
  }

  async createCsocTestPosts(count: number): Promise<TechhubPost[]> {
    if (!Number.isInteger(count) || count < 1 || count > 20) {
      throw new Error("Create between 1 and 20 test posts");
    }

    const userResponse = await fetch(
      `${this.restUrl}/${this.config.usersTable}?username=eq.csoc&select=id&limit=1`,
      { headers: this.getHeaders(), cache: "no-store" },
    );
    if (!userResponse.ok) {
      throw new Error(`Failed to verify csoc user: ${userResponse.status}`);
    }
    const users = (await userResponse.json()) as { id: number }[];
    if (users.length !== 1) throw new Error("User csoc does not exist");

    const rows = Array.from({ length: count }, () => ({
      title: "Team csoc đang kiểm tra: yêu cầu người dùng TechHub tắt ngay extension/bot tự động đang sử dụng để rà soát dấu hiệu vi phạm nội quy",
      status: "test",
      techhub_id: 900_000_000_000_000 + Number.parseInt(crypto.randomUUID().slice(0, 12), 16),
      techhub_uuid: `csoc-test-${crypto.randomUUID()}`,
      username: "csoc",
      url: null,
      votes_score: 0,
      comments_count: 0,
      feed_score: 0,
      medals: [],
      is_blacklisted: true,
      is_auto_reply_enabled: false,
      is_ultra: false,
      created_at: null,
    }));

    const response = await fetch(`${this.restUrl}/posts`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(rows),
      cache: "no-store",
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Failed to create csoc test posts: ${response.status} ${detail}`);
    }
    const posts = (await response.json()) as TechhubPost[];
    if (posts.length !== count) {
      throw new Error(`Expected ${count} test posts, received ${posts.length}`);
    }
    return posts;
  }

  async updatePostFlags(
    techhubId: number,
    updates: { is_ultra?: boolean; is_blacklisted?: boolean },
  ): Promise<TechhubPost | null> {
    const payload: { is_ultra?: boolean; is_blacklisted?: boolean } = {};
    if ("is_ultra" in updates) payload.is_ultra = !!updates.is_ultra;
    if ("is_blacklisted" in updates) payload.is_blacklisted = !!updates.is_blacklisted;
    if (Object.keys(payload).length === 0) {
      throw new Error("No post flags to update");
    }

    if ("is_ultra" in payload) {
      await this.updatePostUltraStatus(techhubId, payload.is_ultra!);
      delete payload.is_ultra;
    }

    if (Object.keys(payload).length > 0) {
      const url = `${this.restUrl}/posts?techhub_id=eq.${techhubId}`;
      const response = await fetch(url, {
        method: "PATCH",
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Failed to update post: ${response.status} ${errText}`);
      }
    }

    return this.getPostByTechhubId(techhubId);
  }

  private async updatePostUltraStatus(
    techhubId: number,
    enabled: boolean,
  ): Promise<void> {
    if (!this.config.adminPasscode) {
      throw new Error("TECHHUB_ADMIN_PASSCODE_NOT_CONFIGURED");
    }

    const response = await fetch(`${this.restUrl}/rpc/admin_set_post_ultra`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        p_techhub_id: techhubId,
        p_is_ultra: enabled,
        p_passcode: this.config.adminPasscode,
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(
        `Failed to update Ultra post ${techhubId}: ${response.status} ${errText}`,
      );
    }
  }

  async updatePostsUltra(
    techhubIds: number[],
    enabled: boolean,
  ): Promise<TechhubPost[]> {
    const ids = [...new Set(techhubIds)].filter(
      (id) => Number.isInteger(id) && id > 0,
    );
    if (ids.length === 0 || ids.length > 20) {
      throw new Error("Bulk Ultra update requires 1 to 20 valid post IDs");
    }

    await Promise.all(ids.map((id) => this.updatePostUltraStatus(id, enabled)));

    const posts = await Promise.all(ids.map((id) => this.getPostByTechhubId(id)));
    return posts.filter((post): post is TechhubPost => post !== null);
  }

  async getInteractionsByTechhubId(techhubId: number): Promise<TechhubInteraction[]> {
    const url =
      `${this.restUrl}/interactions?techhub_id=eq.${techhubId}` +
      "&select=id,username,interaction_type,created_at&order=created_at.desc";
    const response = await fetch(url, {
      method: "GET",
      headers: this.getHeaders(),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch interactions: ${response.status}`);
    }

    return (await response.json()) as TechhubInteraction[];
  }

  async deleteInteractionsByTechhubId(techhubId: number): Promise<TechhubInteraction[]> {
    const url = `${this.restUrl}/interactions?techhub_id=eq.${techhubId}`;
    const response = await fetch(url, {
      method: "DELETE",
      headers: this.getHeaders(),
      cache: "no-store",
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed to delete interactions: ${response.status} ${errText}`);
    }

    return (await response.json()) as TechhubInteraction[];
  }

  private async deleteRowsByTechhubId(
    table: string,
    techhubId: number,
  ): Promise<number> {
    const url = `${this.restUrl}/${table}?techhub_id=eq.${techhubId}`;
    const response = await fetch(url, {
      method: "DELETE",
      headers: this.getHeaders(),
      cache: "no-store",
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(
        `Failed to delete ${table} for post ${techhubId}: ${response.status} ${errText}`,
      );
    }

    const rows = (await response.json().catch(() => [])) as unknown[];
    return Array.isArray(rows) ? rows.length : 0;
  }

  async deletePostByTechhubId(
    techhubId: number,
  ): Promise<TechhubPostDeleteResult> {
    const post = await this.getPostByTechhubId(techhubId);
    const deleted = {
      posts: 0,
      interactions: 0,
      post_discussions: 0,
      user_post_discussions: 0,
      posts_to_unvote: 0,
      posts_to_delete: 0,
    };

    if (post) {
      deleted.posts = await this.deleteRowsByTechhubId("posts", techhubId);
      const remainingPost = await this.getPostByTechhubId(techhubId);
      if (remainingPost) {
        throw new Error(`Post ${techhubId} still exists after delete`);
      }
      // Some PostgREST configurations return an empty body for a successful delete.
      if (deleted.posts === 0) deleted.posts = 1;
    }

    // post_discussions and user_post_discussions normally cascade from posts,
    // but explicit cleanup also removes historical orphan rows safely.
    for (const table of [
      "interactions",
      "user_post_discussions",
      "post_discussions",
      "posts_to_unvote",
      "posts_to_delete",
    ] as const) {
      deleted[table] = await this.deleteRowsByTechhubId(table, techhubId);
    }

    return { post, deleted };
  }
}
