/** The routes of the web app. Functions build the paths that carry an id. */
export const paths = {
  home: '/',
  spaces: '/spaces',
  newSpace: '/spaces/new',
  space: (spaceId: string) => `/spaces/${spaceId}`,
  spaceDocuments: (spaceId: string) => `/spaces/${spaceId}/documents`,
  spaceStudy: (spaceId: string) => `/spaces/${spaceId}/study`,
  spaceMembers: (spaceId: string) => `/spaces/${spaceId}/members`,
  snap: (spaceId: string, snapId: string) => `/spaces/${spaceId}/snaps/${snapId}`,
  spaceAsk: (spaceId: string) => `/spaces/${spaceId}/ask`,
  compose: (spaceId: string) => `/spaces/${spaceId}/compose`,
  document: (documentId: string) => `/documents/${documentId}`,
  /** The page to join a Space, with the invite code already filled in when there is one. */
  join: (code?: string) => (code === undefined ? '/join' : `/join/${code}`),
  capture: '/capture',
  /** The camera with a Space already chosen. */
  captureIn: (spaceId: string) => `/capture?space=${encodeURIComponent(spaceId)}`,
  explore: '/explore',
  exploreTag: (hashtag: string) => `/explore?hashtag=${encodeURIComponent(hashtag)}`,
  newPost: '/posts/new',
  /** A public profile; it opens without a session too. */
  user: (username: string) => `/u/${username}`,
  admin: '/admin',
  profile: '/profile',
  login: '/login',
  register: '/register',
} as const;
