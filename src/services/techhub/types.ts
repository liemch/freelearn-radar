export const TECHHUB_ADMIN_SETTING_KEYS = [
  "enable_auto_reply",
  "enable_bulk_comment",
  "max_comments",
  "target_max_age_days",
  "max_interactions_per_post",
  "push_ultra",
  "exceed_max_1_users",
  "exceed_max_3_users",
] as const;

export type TechhubSettingKey = (typeof TECHHUB_ADMIN_SETTING_KEYS)[number];

export type TechhubSettingRow = {
  id: number;
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string | null;
};

export type TechhubPost = {
  id: number;
  title: string | null;
  status: string | null;
  techhub_id: number | null;
  techhub_uuid: string | null;
  username: string | null;
  url: string | null;
  votes_score: number;
  comments_count: number;
  feed_score: number;
  is_ultra?: boolean;
  is_blacklisted?: boolean;
  created_at: string;
  published_at: string | null;
};

export type TechhubInteraction = {
  id: number;
  username: string;
  interaction_type: string;
  created_at: string;
};

export type TechhubConfig = {
  url: string;
  anonKey: string;
  usersTable: string;
};
