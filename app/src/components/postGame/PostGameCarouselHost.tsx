import React, { useEffect, useState, useSyncExternalStore } from 'react';

import PostGameCarouselModal from './PostGameCarouselModal';
import {
  getPostGameCarouselState,
  hidePostGameCarousel,
  subscribePostGameCarousel,
} from './postGameStore';
import { useAppTheme } from '../../theme/ThemeContext';

export default function PostGameCarouselHost() {
  const { colors } = useAppTheme();
  const snapshot = useSyncExternalStore(
    subscribePostGameCarousel,
    getPostGameCarouselState,
    getPostGameCarouselState,
  );
  const [visible, setVisible] = useState(snapshot.visible);

  useEffect(() => {
    setVisible(snapshot.visible);
  }, [snapshot.visible]);

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
