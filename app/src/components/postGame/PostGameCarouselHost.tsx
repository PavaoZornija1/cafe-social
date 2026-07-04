import React, { useEffect, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import PostGameCarouselModal from './PostGameCarouselModal';
import {
  getPostGameCarouselState,
  hidePostGameCarousel,
  completePostGameCarousel,
  subscribePostGameCarousel,
  subscribePostGameDismiss,
} from './postGameStore';
import { invalidatePostGameProgress } from '../../query/invalidateVenueSession';
import { useAppTheme } from '../../theme/ThemeContext';

export default function PostGameCarouselHost() {
  const { colors } = useAppTheme();
  const queryClient = useQueryClient();
  const snapshot = useSyncExternalStore(
    subscribePostGameCarousel,
    getPostGameCarouselState,
    getPostGameCarouselState,
  );

  useEffect(() => {
    return subscribePostGameDismiss((reason) => {
      if (reason === 'complete') {
        void invalidatePostGameProgress(queryClient);
      }
    });
  }, [queryClient]);

  return (
    <PostGameCarouselModal
      colors={colors}
      visible={snapshot.visible}
      payload={snapshot.payload}
      actions={snapshot.actions}
      onClose={() => hidePostGameCarousel()}
      onComplete={() => completePostGameCarousel()}
    />
  );
}
