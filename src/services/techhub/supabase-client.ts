import type {
  TechhubConfig,
  TechhubInteraction,
  TechhubPost,
  TechhubSettingRow,
} from "@/services/techhub/types";

type UpdateSettingOptions = {
  preserveUpdatedAt?: boolean;
};

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

  async getSettings(keys: string[] | null = null): Promise<Record<string, TechhubSettingRow>> {
    let url = `${this.restUrl}/settings?select=*&order=key`;
    if (keys && keys.length > 0) {
      url += `&key=in.(${keys.map((key) => encodeURIComponent(key)).join(",")})`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers: this.getHeaders(),
      cache: "no-store",
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`Failed to fetch settings: ${response.status} ${errText}`);
    }

    const rows = (await response.json()) as TechhubSettingRow[];
    const map: Record<string, TechhubSettingRow> = {};
    for (const row of rows) {
      map[row.key] = row;
    }
    return map;
  }

  async updateSetting(
    key: string,
    value: unknown,
    options: UpdateSettingOptions = {},
  ): Promise<TechhubSettingRow | null> {
    const preserveUpdatedAt = options.preserveUpdatedAt !== false;
    const currentMap = await this.getSettings([key]).catch(() => ({}));
    const current = currentMap[key];
    if (!current) {
      const url = `${this.restUrl}/settings`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          ...this.getHeaders(),
          Prefer: "return=representation, resolution=merge-duplicates",
        },
        body: JSON.stringify({ key, value }),
        cache: "no-store",
      });
      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(`Failed to create setting ${key}: ${response.status} ${errText}`);
      }
      const data = (await response.json().catch(() => [])) as TechhubSettingRow[];
      return Array.isArray(data) && data.length > 0 ? data[0] : null;
    }

    const payload: { value: unknown; updated_at?: string } = { value };
    if (preserveUpdatedAt && current.updated_at) {
      payload.updated_at = current.updated_at;
    }

    const url = `${this.restUrl}/settings?key=eq.${encodeURIComponent(key)}`;
    const response = await fetch(url, {
      method: "PATCH",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`Failed to update setting ${key}: ${response.status} ${errText}`);
    }

    const data = (await response.json().catch(() => [])) as TechhubSettingRow[];
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
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

    const data = (await response.json()) as TechhubPost[];
    return data.length > 0 ? data[0] : null;
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
}
