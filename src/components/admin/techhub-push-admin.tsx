"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import { AdminPanel } from "@/components/admin/admin-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAdminDictionary } from "@/lib/i18n/admin";
import type { Locale } from "@/lib/i18n/config";
import type { TechhubPost } from "@/services/techhub/types";

type TechhubPushAdminProps = {
  locale: Locale;
  initialConfigured: boolean;
  initialConnected: boolean;
};

function parseSettingBool(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function formatPostPreview(post: TechhubPost): string {
  return `#${post.techhub_id} · @${post.username ?? "-"} · cmt=${post.comments_count} · fs=${post.feed_score} · ultra=${post.is_ultra ?? false} · ${post.title ?? ""}`;
}

export function TechhubPushAdmin({
  locale,
  initialConfigured,
  initialConnected,
}: TechhubPushAdminProps) {
  const labels = getAdminDictionary(locale).techhub;
  const [pending, startTransition] = useTransition();
  const [configured] = useState(initialConfigured);
  const [connected, setConnected] = useState(initialConnected);

  const [maxComments, setMaxComments] = useState("");
  const [enableAutoReply, setEnableAutoReply] = useState(false);
  const [enableBulkComment, setEnableBulkComment] = useState(false);
  const [targetMaxAgeDays, setTargetMaxAgeDays] = useState("");
  const [maxInteractionsPerPost, setMaxInteractionsPerPost] = useState("");
  const [pushUltra, setPushUltra] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const [techhubId, setTechhubId] = useState("");
  const [postPreview, setPostPreview] = useState<string | null>(null);
  const [postMessage, setPostMessage] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [ultraPosts, setUltraPosts] = useState<TechhubPost[]>([]);
  const [ultraScanMessage, setUltraScanMessage] = useState<string | null>(null);
  const [filterUsername, setFilterUsername] = useState("");
  const [userPosts, setUserPosts] = useState<TechhubPost[]>([]);
  const [userPostsMessage, setUserPostsMessage] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setSettingsMessage(labels.loadingSettings);
    setSettingsError(null);

    try {
      const response = await fetch("/api/admin/techhub/settings");
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? labels.loadFailed);
      }

      setMaxComments(
        payload.settings?.max_comments != null
          ? String(payload.settings.max_comments)
          : "",
      );
      setEnableAutoReply(parseSettingBool(payload.settings?.enable_auto_reply));
      setEnableBulkComment(
        parseSettingBool(payload.settings?.enable_bulk_comment),
      );
      setTargetMaxAgeDays(
        payload.settings?.target_max_age_days != null
          ? String(payload.settings.target_max_age_days)
          : "",
      );
      setMaxInteractionsPerPost(
        payload.settings?.max_interactions_per_post != null
          ? String(payload.settings.max_interactions_per_post)
          : "",
      );
      setPushUltra(parseSettingBool(payload.settings?.push_ultra));
      setSettingsMessage(labels.settingsLoaded);
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : labels.loadFailed);
      setSettingsMessage(null);
    }
  }, [labels]);

  useEffect(() => {
    if (!configured || !connected) return;
    void loadSettings();
  }, [configured, connected, loadSettings]);

  function saveSettings() {
    startTransition(async () => {
      setSettingsMessage(null);
      setSettingsError(null);

      const maxCommentsValue = Number(maxComments);
      const targetMaxAgeDaysValue = Number(targetMaxAgeDays);
      const maxInteractionsPerPostValue = Number(maxInteractionsPerPost);
      if (!Number.isFinite(maxCommentsValue) || maxCommentsValue < 1) {
        setSettingsError(labels.invalidMaxComments);
        return;
      }
      if (!Number.isInteger(targetMaxAgeDaysValue) || targetMaxAgeDaysValue < 1) {
        setSettingsError(labels.invalidTargetMaxAgeDays);
        return;
      }
      if (
        !Number.isInteger(maxInteractionsPerPostValue) ||
        maxInteractionsPerPostValue < 1
      ) {
        setSettingsError(labels.invalidMaxInteractionsPerPost);
        return;
      }

      try {
        const response = await fetch("/api/admin/techhub/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enable_auto_reply: enableAutoReply,
            enable_bulk_comment: enableBulkComment,
            max_comments: maxCommentsValue,
            target_max_age_days: targetMaxAgeDaysValue,
            max_interactions_per_post: maxInteractionsPerPostValue,
            push_ultra: pushUltra,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error ?? labels.saveFailed);
        }
        setSettingsMessage(labels.settingsSaved);
      } catch (error) {
        setSettingsError(error instanceof Error ? error.message : labels.saveFailed);
      }
    });
  }

  function lookupPost() {
    const id = Number(techhubId);
    if (!Number.isFinite(id) || id < 1) {
      setPostError(labels.invalidTechhubId);
      setPostMessage(null);
      setPostPreview(null);
      return;
    }

    startTransition(async () => {
      setPostMessage(labels.lookingUpPost);
      setPostError(null);

      try {
        const response = await fetch(`/api/admin/techhub/posts/${id}`);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error ?? labels.postNotFound(id));
        }

        setPostPreview(formatPostPreview(payload.post));
        setPostMessage(labels.postFound(payload.interactionCount ?? 0));
      } catch (error) {
        setPostPreview(null);
        setPostError(error instanceof Error ? error.message : labels.loadFailed);
        setPostMessage(null);
      }
    });
  }

  function scanUltraPosts() {
    startTransition(async () => {
      setUltraScanMessage(labels.scanningUltraPosts);
      setPostError(null);

      try {
        const response = await fetch("/api/admin/techhub/posts/ultra");
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error ?? labels.scanUltraFailed);
        }

        const posts = Array.isArray(payload.posts) ? payload.posts : [];
        setUltraPosts(posts);
        setUltraScanMessage(labels.ultraPostsFound(posts.length));
      } catch (error) {
        setUltraPosts([]);
        setUltraScanMessage(null);
        setPostError(
          error instanceof Error ? error.message : labels.scanUltraFailed,
        );
      }
    });
  }

  function scanUserPosts() {
    const username = filterUsername.trim();
    if (!username) {
      setPostError(labels.invalidFilterUsername);
      setUserPosts([]);
      setUserPostsMessage(null);
      return;
    }

    startTransition(async () => {
      setUserPostsMessage(labels.scanningUserPosts(username));
      setPostError(null);

      try {
        const response = await fetch(
          `/api/admin/techhub/posts/recent?username=${encodeURIComponent(username)}`,
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error ?? labels.scanUserPostsFailed);
        }

        const posts = Array.isArray(payload.posts) ? payload.posts : [];
        setUserPosts(posts);
        setUserPostsMessage(labels.userPostsFound(payload.username ?? username, posts.length));
      } catch (error) {
        setUserPosts([]);
        setUserPostsMessage(null);
        setPostError(
          error instanceof Error ? error.message : labels.scanUserPostsFailed,
        );
      }
    });
  }

  function setUltra(enabled: boolean) {
    const id = Number(techhubId);
    if (!Number.isFinite(id) || id < 1) {
      setPostError(labels.invalidTechhubId);
      return;
    }

    startTransition(async () => {
      setPostError(null);

      try {
        const response = await fetch(`/api/admin/techhub/posts/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_ultra: enabled }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error ?? labels.saveFailed);
        }

        setPostPreview(formatPostPreview(payload.post));
        setPostMessage(
          enabled ? labels.ultraEnabled(id) : labels.ultraDisabled(id),
        );
      } catch (error) {
        setPostError(error instanceof Error ? error.message : labels.saveFailed);
      }
    });
  }

  function deleteInteractions() {
    const id = Number(techhubId);
    if (!Number.isFinite(id) || id < 1) {
      setPostError(labels.invalidTechhubId);
      return;
    }

    startTransition(async () => {
      setPostError(null);

      try {
        const lookupResponse = await fetch(`/api/admin/techhub/posts/${id}`);
        const lookupPayload = await lookupResponse.json().catch(() => ({}));
        if (!lookupResponse.ok) {
          throw new Error(lookupPayload.error ?? labels.postNotFound(id));
        }

        const count = lookupPayload.interactionCount ?? 0;
        if (count === 0) {
          setPostMessage(labels.noInteractions(id));
          return;
        }

        const username = lookupPayload.post?.username ?? "-";
        const confirmed = window.confirm(
          labels.deleteConfirm(count, id, username),
        );
        if (!confirmed) return;

        const response = await fetch(`/api/admin/techhub/posts/${id}/interactions`, {
          method: "DELETE",
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error ?? labels.saveFailed);
        }

        setPostMessage(
          labels.interactionsDeleted(payload.deleted ?? 0, payload.remaining ?? 0),
        );
      } catch (error) {
        setPostError(error instanceof Error ? error.message : labels.saveFailed);
      }
    });
  }

  if (!configured) {
    return (
      <div className="rounded border border-border bg-card px-3.5 py-3 text-[0.8125rem] text-muted-foreground">
        <p className="font-medium text-foreground">{labels.notConfigured}</p>
        <p className="mt-1">{labels.notConfiguredHint}</p>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="rounded border border-destructive/30 bg-card px-3.5 py-3 text-[0.8125rem]">
        <p className="font-medium text-destructive">{labels.connectionFailed}</p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-3"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const response = await fetch("/api/admin/techhub/status");
              const payload = await response.json().catch(() => ({}));
              setConnected(Boolean(payload.connected));
            });
          }}
        >
          {labels.retry}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <AdminPanel title={labels.globalSettings} description={labels.globalSettingsHint}>
        <div className="space-y-3 text-[0.8125rem]">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={enableAutoReply}
              onChange={(event) => setEnableAutoReply(event.target.checked)}
            />
            <span>{labels.enableAutoReply}</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={enableBulkComment}
              onChange={(event) => setEnableBulkComment(event.target.checked)}
            />
            <span>{labels.enableBulkComment}</span>
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              {labels.maxComments}
            </span>
            <Input
              type="number"
              min={1}
              max={200}
              value={maxComments}
              onChange={(event) => setMaxComments(event.target.value)}
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              {labels.targetMaxAgeDays}
            </span>
            <Input
              type="number"
              min={1}
              max={365}
              value={targetMaxAgeDays}
              onChange={(event) => setTargetMaxAgeDays(event.target.value)}
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              {labels.maxInteractionsPerPost}
            </span>
            <Input
              type="number"
              min={1}
              max={100}
              value={maxInteractionsPerPost}
              onChange={(event) => setMaxInteractionsPerPost(event.target.value)}
            />
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={pushUltra}
              onChange={(event) => setPushUltra(event.target.checked)}
            />
            <span>{labels.pushUltra}</span>
          </label>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" size="sm" disabled={pending} onClick={saveSettings}>
              {labels.saveSettings}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => void loadSettings()}
            >
              {labels.reloadSettings}
            </Button>
          </div>

          {settingsMessage ? (
            <p className="text-xs text-muted-foreground">{settingsMessage}</p>
          ) : null}
          {settingsError ? (
            <p className="text-xs text-destructive">{settingsError}</p>
          ) : null}
        </div>
      </AdminPanel>

      <AdminPanel title={labels.pushPost} description={labels.pushPostHint}>
        <div className="space-y-3 text-[0.8125rem]">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              {labels.techhubId}
            </span>
            <Input
              type="number"
              min={1}
              placeholder="vd: 4081"
              value={techhubId}
              onChange={(event) => setTechhubId(event.target.value)}
            />
          </label>

          {postPreview ? (
            <p className="rounded border border-border/60 bg-muted/30 px-2.5 py-2 text-xs text-muted-foreground">
              {postPreview}
            </p>
          ) : null}

          <div className="space-y-2 rounded border border-border/60 p-2.5">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                {labels.filterUsername}
              </span>
              <Input
                value={filterUsername}
                placeholder="vd: phatnv8"
                onChange={(event) => setFilterUsername(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") scanUserPosts();
                }}
              />
            </label>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={scanUserPosts}
            >
              {labels.scanUserPosts}
            </Button>

            {userPostsMessage ? (
              <p className="text-xs text-muted-foreground">{userPostsMessage}</p>
            ) : null}

            {userPosts.length > 0 ? (
              <div className="max-h-80 space-y-2 overflow-y-auto">
                {userPosts.map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    className="block w-full rounded border border-border/60 bg-muted/20 px-2.5 py-2 text-left text-xs text-muted-foreground hover:bg-muted/50"
                    onClick={() => {
                      setTechhubId(String(post.techhub_id ?? ""));
                      setPostPreview(formatPostPreview(post));
                      setPostMessage(
                        labels.userPostSelected(post.techhub_id ?? 0),
                      );
                    }}
                  >
                    {formatPostPreview(post)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={scanUltraPosts}
            >
              {labels.scanUltraPosts}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={lookupPost}
            >
              {labels.lookupPost}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => setUltra(true)}
            >
              {labels.enableUltra}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => setUltra(false)}
            >
              {labels.disableUltra}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={deleteInteractions}
            >
              {labels.deleteInteractions}
            </Button>
          </div>

          {ultraScanMessage ? (
            <p className="text-xs text-muted-foreground">{ultraScanMessage}</p>
          ) : null}

          {ultraPosts.length > 0 ? (
            <div className="max-h-80 space-y-2 overflow-y-auto rounded border border-border/60 p-2">
              {ultraPosts.map((post) => (
                <button
                  key={post.id}
                  type="button"
                  className="block w-full rounded border border-border/60 bg-muted/20 px-2.5 py-2 text-left text-xs text-muted-foreground hover:bg-muted/50"
                  onClick={() => {
                    setTechhubId(String(post.techhub_id ?? ""));
                    setPostPreview(formatPostPreview(post));
                    setPostMessage(labels.ultraPostSelected(post.techhub_id ?? 0));
                  }}
                >
                  {formatPostPreview(post)}
                </button>
              ))}
            </div>
          ) : null}

          {postMessage ? (
            <p className="text-xs text-muted-foreground">{postMessage}</p>
          ) : null}
          {postError ? (
            <p className="text-xs text-destructive">{postError}</p>
          ) : null}

          <p className="text-xs text-muted-foreground">{labels.deleteHint}</p>
        </div>
      </AdminPanel>
    </div>
  );
}
