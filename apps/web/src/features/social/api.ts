import {
  commentSchema,
  followStateSchema,
  likeStateSchema,
  momentGroupSchema,
  postDraftSchema,
  postSchema,
  publicUserProfileSchema,
  trendingHashtagSchema,
  type Comment,
  type CreatePostBody,
  type FollowState,
  type LikeState,
  type MomentGroup,
  type Post,
  type PostDraft,
  type PublicUserProfile,
  type TrendingHashtag,
} from '@snapia/shared';
import { z } from 'zod';
import { apiRequest, apiSend } from '../../lib/http';
import { apiPage, withQuery, type Page } from '../../lib/pagination';

export const socialKeys = {
  moments: ['moments'] as const,
  feed: ['feed'] as const,
  explore: (hashtag: string) => ['explore', hashtag] as const,
  trending: ['explore', 'trending'] as const,
  comments: (postId: string) => ['comments', postId] as const,
  profile: (username: string) => ['users', username] as const,
  userPosts: (username: string) => ['users', username, 'posts'] as const,
  draft: (snapIds: string[]) => ['post-draft', ...snapIds] as const,
};

export async function getMomentsFeed(signal?: AbortSignal): Promise<MomentGroup[]> {
  return (await apiRequest('/moments/feed', z.array(momentGroupSchema), { signal })).data;
}

export function viewMoment(momentId: string): Promise<void> {
  return apiSend(`/moments/${momentId}/view`, { method: 'POST' });
}

export function getFeed(cursor: string | null, signal?: AbortSignal): Promise<Page<Post>> {
  return apiPage('/feed', postSchema, { cursor, signal });
}

export function getExplore(
  hashtag: string,
  cursor: string | null,
  signal?: AbortSignal,
): Promise<Page<Post>> {
  return apiPage(withQuery('/explore', { hashtag: hashtag === '' ? null : hashtag }), postSchema, {
    cursor,
    signal,
  });
}

export async function getTrending(signal?: AbortSignal): Promise<TrendingHashtag[]> {
  return (await apiRequest('/explore/trending', z.array(trendingHashtagSchema), { signal })).data;
}

export async function toggleLike(postId: string): Promise<LikeState> {
  return (await apiRequest(`/posts/${postId}/like`, likeStateSchema, { method: 'POST' })).data;
}

export function listComments(
  postId: string,
  cursor: string | null,
  signal?: AbortSignal,
): Promise<Page<Comment>> {
  return apiPage(`/posts/${postId}/comments`, commentSchema, { cursor, signal });
}

export async function addComment(postId: string, body: string): Promise<Comment> {
  return (
    await apiRequest(`/posts/${postId}/comments`, commentSchema, {
      method: 'POST',
      body: { body },
    })
  ).data;
}

export async function getPostDraft(snapIds: string[], signal?: AbortSignal): Promise<PostDraft> {
  return (
    await apiRequest('/posts/draft', postDraftSchema, {
      method: 'POST',
      body: { snapIds },
      signal,
    })
  ).data;
}

export async function createPost(body: CreatePostBody): Promise<Post> {
  return (await apiRequest('/posts', postSchema, { method: 'POST', body })).data;
}

export async function getProfile(
  username: string,
  signal?: AbortSignal,
): Promise<PublicUserProfile> {
  return (await apiRequest(`/users/${username}`, publicUserProfileSchema, { signal })).data;
}

export function getUserPosts(
  username: string,
  cursor: string | null,
  signal?: AbortSignal,
): Promise<Page<Post>> {
  return apiPage(`/users/${username}/posts`, postSchema, { cursor, signal });
}

export async function setFollow(username: string, follow: boolean): Promise<FollowState> {
  return (
    await apiRequest(`/users/${username}/follow`, followStateSchema, {
      method: follow ? 'POST' : 'DELETE',
    })
  ).data;
}
