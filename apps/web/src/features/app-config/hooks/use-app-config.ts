import { useQuery } from '@tanstack/react-query';
import { appConfigKeys, getAppConfig } from '../api';

/** Read once per visit: the values only change when an admin edits them or the API restarts. */
export function useAppConfig() {
  return useQuery({
    queryKey: appConfigKeys.all,
    queryFn: ({ signal }) => getAppConfig(signal),
    staleTime: Infinity,
  });
}
