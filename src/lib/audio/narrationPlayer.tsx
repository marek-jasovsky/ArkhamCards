import { useSelector } from 'react-redux';
import { useContext, useEffect, useState } from 'react';
import { isEqual } from 'lodash';
import TrackPlayer, { EmitterSubscription, EventType, Track, State, useTrackPlayerEvents } from 'react-native-track-player';

import { useInterval } from '@components/core/hooks';
import { hasDissonantVoices } from '@reducers';
import LanguageContext from '@lib/i18n/LanguageContext';

export function useAudioAccess(): [boolean, string | undefined] {
  const { lang } = useContext(LanguageContext);
  const hasDV = useSelector(hasDissonantVoices);
  return [
    (lang === 'ru') || hasDV,
    hasDV ? undefined : lang,
  ];
}

interface TrackPlayerFunctions {
  getQueue: () => Promise<Track[]>;
  getTrack: (id: string) => Promise<Track>;
  getState: () => Promise<State>;
  addEventListener: (type: EventType, listener: (data: any) => void) => EmitterSubscription;
  getCurrentTrack: () => Promise<string>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  skipToNext: () => Promise<void>;
  skip: (trackId: string) => Promise<void>;
  add: (tracks: Track | Track[], insertBeforeId?: string) => Promise<void>;
  remove: (trackIds: string | string[]) => Promise<void>;
  reset: () => Promise<void>;
  seekTo: (seconds: number) => Promise<void>;
  skipToPrevious: () => Promise<void>;
  getPosition: () => Promise<number>;
  removeUpcomingTracks: () => Promise<void>;
}

let _narrationPromise: Promise<TrackPlayerFunctions> | null = null;
export function narrationPlayer(): Promise<TrackPlayerFunctions> {
  if (_narrationPromise === null) {
    _narrationPromise = new Promise<TrackPlayerFunctions>((resolve, reject) => {
      try {
        TrackPlayer.setupPlayer({
          iosCategory: 'playback',
          iosCategoryMode: 'spokenAudio',
        }).then(() => {
          TrackPlayer.updateOptions({
            stopWithApp: true,
            capabilities: [
              TrackPlayer.CAPABILITY_PLAY,
              TrackPlayer.CAPABILITY_PAUSE,
              TrackPlayer.CAPABILITY_SKIP_TO_NEXT,
              TrackPlayer.CAPABILITY_SKIP_TO_PREVIOUS,
              TrackPlayer.CAPABILITY_JUMP_BACKWARD,
            ],
            compactCapabilities: [
              TrackPlayer.CAPABILITY_PLAY,
              TrackPlayer.CAPABILITY_PAUSE,
            ],
          });
          TrackPlayer.registerPlaybackService(() => async() => {
            TrackPlayer.addEventListener('remote-play', TrackPlayer.play);
            TrackPlayer.addEventListener('remote-pause', TrackPlayer.pause);
            TrackPlayer.addEventListener('remote-next', TrackPlayer.skipToNext);
            TrackPlayer.addEventListener('remote-previous', TrackPlayer.skipToPrevious);
          });
          resolve({
            getQueue: TrackPlayer.getQueue,
            getCurrentTrack: TrackPlayer.getCurrentTrack,
            getTrack: TrackPlayer.getTrack,
            addEventListener: TrackPlayer.addEventListener,
            play: TrackPlayer.play,
            pause: TrackPlayer.pause,
            stop: TrackPlayer.stop,
            skipToNext: TrackPlayer.skipToNext,
            getState: TrackPlayer.getState,
            skip: TrackPlayer.skip,
            add: TrackPlayer.add,
            remove: TrackPlayer.remove,
            reset: TrackPlayer.reset,
            seekTo: TrackPlayer.seekTo,
            skipToPrevious: TrackPlayer.skipToPrevious,
            getPosition: TrackPlayer.getPosition,
            removeUpcomingTracks: TrackPlayer.removeUpcomingTracks,
          });
        }, reject);
      } catch (e) {
        reject(e);
      }
    });
  }
  return _narrationPromise;
}

export function useTrackPlayerQueue(interval: number = 100) {
  const [state, setState] = useState<TrackPlayer.Track[]>([]);
  const getProgress = async() => {
    const trackPlayer = await narrationPlayer();
    const newQueue = await trackPlayer.getQueue();
    if (!isEqual(newQueue, state)) {
      setState(newQueue);
    }
  };

  useInterval(getProgress, interval);
  return state;
}

export function useCurrentTrackId(): string | null {
  const [state, setState] = useState<string | null>(null);
  useEffect(() => {
    narrationPlayer().then(trackPlayer => {
      trackPlayer.getCurrentTrack().then(currentTrack => setState(currentTrack));
    });
  }, []);
  useTrackPlayerEvents(['playback-track-changed'],
    (event: any) => {
      if (event.type === 'playback-track-changed') {
        setState(event.nextTrack);
      }
    }
  );
  return state;
}

export function useTrackDetails(id: string | null) {
  const [track, setTrack] = useState<TrackPlayer.Track | null>(null);
  useEffect(() => {
    let canceled = false;
    narrationPlayer().then(trackPlayer => {
      if (id) {
        trackPlayer.getTrack(id).then(track => {
          if (!canceled) {
            setTrack(track);
          }
        });
      }
      return function cancel() {
        canceled = true;
      };
    });
  }, [id]);
  return track;
}

export function useStopAudioOnUnmount() {
  const [hasDV] = useAudioAccess();
  useEffect(() => {
    if (hasDV) {
      return function() {
        narrationPlayer().then(trackPlayer => {
          trackPlayer.stop().then(() => trackPlayer.removeUpcomingTracks());
        });
      };
    }
  }, [hasDV]);
}