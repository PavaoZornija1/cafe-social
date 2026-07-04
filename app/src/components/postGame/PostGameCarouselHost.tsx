import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import PostGameCarouselModal from './PostGameCarouselModal';
import {
  getPostGameCarouselState,
  hidePostGameCarousel,
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
  const [visible, setVisible] = useState(snapshot.visible);

  useEffect(() => {
    setVisible(snapshot.visible);
  }, [snapshot.visible]);

  useEffect(() => {
    return subscribePostGameDismiss(() => {
      void invalidatePostGameProgress(queryClient);
    });
  }, [queryClient]);

  return (
    <PostGameCarouselModal
      colors={colors}
      visible={visible}
      payload={snapshot.payload}
      actions={snapshot.actions}
      onClose={() => hidePostGameCarousel()}
    />
  );
}
