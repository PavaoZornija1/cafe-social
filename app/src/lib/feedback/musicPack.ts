/**
 * Which background music bundle to play.
 *
 * - `kenney` — Farm Frolics / Mischief Stroll (current vibe; may need crossfade looping)
 * - `seamless` — OpenGameArt loops (see assets/sounds/music/alternates/)
 *
 * Flip this on device to A/B test. Run `npm run fetch-seamless-music` first.
 */
export type MusicPackId = 'kenney' | 'seamless';

/** Change to `'seamless'` to audition OGA loops; `'kenney'` for current tracks. */
export const MUSIC_PACK: MusicPackId = 'kenney';

export type BackgroundMusicTrack = 'home' | 'game';

type TrackSources = Record<BackgroundMusicTrack, number>;

const KENNEY_SOURCES: TrackSources = {
  home: require('../../../assets/sounds/music/cafe_home.m4a'),
  game: require('../../../assets/sounds/music/cafe_game.m4a'),
};

/** Home: bird night (calm). Game: Head in the Sand (upbeat seamless). */
const SEAMLESS_SOURCES: TrackSources = {
  home: require('../../../assets/sounds/music/alternates/seamless_home_bird_night.m4a'),
  game: require('../../../assets/sounds/music/alternates/seamless_game_head_sand.m4a'),
};

export function getMusicTrackSources(): TrackSources {
  switch (MUSIC_PACK) {
    case 'seamless':
      return SEAMLESS_SOURCES;
    case 'kenney':
      return KENNEY_SOURCES;
    default: {
      const _exhaustive: never = MUSIC_PACK;
      return _exhaustive;
    }
  }
}
