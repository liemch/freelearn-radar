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
  adminPasscode: string;
  usersTable: string;
};

export type TechhubPostDeleteResult = {
  post: TechhubPost | null;
  deleted: Record<
    | "posts"
    | "interactions"
    | "post_discussions"
    | "user_post_discussions"
    | "posts_to_unvote"
    | "posts_to_delete",
    number
  >;
};
