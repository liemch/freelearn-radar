"use client";

import { useState, useTransition } from "react";

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

  const [techhubId, setTechhubId] = useState("");
  const [postPreview, setPostPreview] = useState<string | null>(null);
  const [postMessage, setPostMessage] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [ultraPosts, setUltraPosts] = useState<TechhubPost[]>([]);
  const [ultraScanMessage, setUltraScanMessage] = useState<string | null>(null);
  const [filterUsername, setFilterUsername] = useState("");
  const [userPosts, setUserPosts] = useState<TechhubPost[]>([]);
  const [userPostsMessage, setUserPostsMessage] = useState<string | null>(null);
  const [selectedUserPostIds, setSelectedUserPostIds] = useState<number[]>([]);

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
        setSelectedUserPostIds([]);
        setUserPostsMessage(labels.userPostsFound(payload.username ?? username, posts.length));
      } catch (error) {
      setUserPosts([]);
      setSelectedUserPostIds([]);
        setUserPostsMessage(null);
        setPostError(
          error instanceof Error ? error.message : labels.scanUserPostsFailed,
        );
      }
    });
  }

  function toggleUserPostSelection(techhubId: number, selected: boolean) {
    setSelectedUserPostIds((current) =>
      selected
        ? [...new Set([...current, techhubId])]
        : current.filter((id) => id !== techhubId),
    );
  }

  function setSelectedPostsUltra(enabled: boolean) {
    if (selectedUserPostIds.length === 0) {
      setPostError(labels.selectAtLeastOnePost);
      return;
    }

    startTransition(async () => {
      setPostError(null);
      setUserPostsMessage(
        labels.updatingSelectedPosts(selectedUserPostIds.length, enabled),
      );

      try {
        const response = await fetch("/api/admin/techhub/posts/bulk-ultra", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            techhub_ids: selectedUserPostIds,
            is_ultra: enabled,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error ?? labels.bulkUltraFailed);
        }

        const updatedPosts = Array.isArray(payload.posts) ? payload.posts : [];
        const updatedById = new Map<number, TechhubPost>(
          updatedPosts.map((post: TechhubPost) => [post.techhub_id ?? 0, post]),
        );
        setUserPosts((current) =>
          current.map((post) => updatedById.get(post.techhub_id ?? 0) ?? post),
        );
        setSelectedUserPostIds([]);
        setUserPostsMessage(
          labels.selectedPostsUpdated(payload.updated ?? 0, enabled),
        );
      } catch (error) {
        setUserPostsMessage(null);
        setPostError(
          error instanceof Error ? error.message : labels.bulkUltraFailed,
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

  function deletePost() {
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

        const post = lookupPayload.post as TechhubPost;
        const confirmed = window.confirm(
          labels.deletePostConfirm(id, post.username ?? "-", post.title ?? ""),
        );
        if (!confirmed) return;

        const response = await fetch(`/api/admin/techhub/posts/${id}`, {
          method: "DELETE",
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error ?? labels.deletePostFailed);
        }

        setPostPreview(null);
        setUltraPosts((current) => current.filter((item) => item.techhub_id !== id));
        setUserPosts((current) => current.filter((item) => item.techhub_id !== id));
        setSelectedUserPostIds((current) => current.filter((item) => item !== id));
        setPostMessage(labels.postDeleted(id));
      } catch (error) {
        setPostError(
          error instanceof Error ? error.message : labels.deletePostFailed,
        );
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
    <div className="grid gap-4">
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
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      setSelectedUserPostIds(
                        userPosts.flatMap((post) =>
                          post.techhub_id == null ? [] : [post.techhub_id],
                        ),
                      )
                    }
                  >
                    {labels.selectAllUserPosts}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={pending || selectedUserPostIds.length === 0}
                    onClick={() => setSelectedUserPostIds([])}
                  >
                    {labels.clearUserPostSelection}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {labels.selectedPostCount(selectedUserPostIds.length)}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending || selectedUserPostIds.length === 0}
                    onClick={() => setSelectedPostsUltra(true)}
                  >
                    {labels.enableSelectedUltra}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={pending || selectedUserPostIds.length === 0}
                    onClick={() => setSelectedPostsUltra(false)}
                  >
                    {labels.disableSelectedUltra}
                  </Button>
                </div>

                <div className="max-h-80 space-y-2 overflow-y-auto">
                  {userPosts.map((post) => {
                    const id = post.techhub_id;
                    if (id == null) return null;
                    return (
                      <div
                        key={post.id}
                        className="flex items-start gap-2 rounded border border-border/60 bg-muted/20 px-2.5 py-2"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={selectedUserPostIds.includes(id)}
                          onChange={(event) =>
                            toggleUserPostSelection(id, event.target.checked)
                          }
                          aria-label={labels.selectPost(id)}
                        />
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setTechhubId(String(id));
                            setPostPreview(formatPostPreview(post));
                            setPostMessage(labels.userPostSelected(id));
                          }}
                        >
                          {formatPostPreview(post)}
                        </button>
                      </div>
                    );
                  })}
                </div>
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
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={deletePost}
            >
              {labels.deletePost}
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
          <p className="text-xs text-destructive">{labels.deletePostHint}</p>
        </div>
      </AdminPanel>
    </div>
  );
}
