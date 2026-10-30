import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { AgeGroup, ageGroup, validBirthYear } from '../game/age';

/** Apart from the journey save, so it never reaches the cloud save and survives Settings > RESET. */
const BIRTH_YEAR_KEY = 'mirror-maze:birth-year';

/** The year of birth from the first-launch age screen, kept on this device only. `group` is undefined until answered. */
export function useAge() {
  const [state, setState] = useState<{ loaded: boolean; birthYear?: number }>({ loaded: false });
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(BIRTH_YEAR_KEY).then(raw => (raw === null ? NaN : Number(raw)), () => NaN).then(year => {
      if (live) setState({ loaded: true, birthYear: validBirthYear(year) ? year : undefined });
    });
    return () => { live = false; };
  }, []);
  const answer = useCallback((year: number) => {
    setState({ loaded: true, birthYear: year });
    // If this fails the answer still holds for this session, and the screen simply asks again next time.
    AsyncStorage.setItem(BIRTH_YEAR_KEY, String(year)).catch(cause => console.warn('Could not store the year of birth', cause));
  }, []);
  const group: AgeGroup | undefined = state.birthYear === undefined ? undefined : ageGroup(state.birthYear);
  return { loaded: state.loaded, group, answer };
}
