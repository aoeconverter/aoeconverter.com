// Browser-only singleton shared by every script on a page.
import { TimeSync } from './timesync';

export const clock = new TimeSync('/api/time');
export const ready = clock.start();
