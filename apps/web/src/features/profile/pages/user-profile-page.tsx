import { useParams } from 'react-router';
import { UserProfile } from '../../social/components/user-profile';

/** /u/:username: anyone can open it, with or without a session. */
export function UserProfilePage() {
  const { username = '' } = useParams();
  return <UserProfile key={username} username={username} />;
}
