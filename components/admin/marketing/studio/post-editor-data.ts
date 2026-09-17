import 'server-only';
import { toShopInputValue } from '@/components/admin/core/parse';
import { dateTime } from '@/lib/format';
import { suggestTimes } from '@/lib/marketing/content/social-service';
import type { SocialPlatform } from '@/lib/marketing/content/types';
import type { PickerOption } from './ImagePicker';
import type { Suggestion } from './PostEditor';
import { mediaOptions } from './social-data';

const TEMPLATES = [
  { value: 'template:seasonal', title: 'Branded title card' },
  { value: 'template:offer', title: 'Big offer card' },
];

/** Image choices: the post's current image (if any), no image, auto-designs, then owner photos. */
export async function pickerOptions(current: { id: string; hasImage: boolean } | null): Promise<PickerOption[]> {
  const photos = await mediaOptions();
  return [
    ...(current?.hasImage ? [{ value: 'keep', title: 'Current', url: `/api/marketing/creative/${current.id}/image?format=1:1`, group: 'Current' }] : []),
    { value: 'none', title: 'No image', url: null, group: 'Auto-design' },
    ...TEMPLATES.map((t) => ({ ...t, url: null, group: 'Auto-design' })),
    ...photos,
  ];
}

/** Next open posting slots for the first chosen network, as datetime-local values. */
export async function timeSuggestions(platform: SocialPlatform): Promise<Suggestion[]> {
  const times = await suggestTimes(platform, 3);
  return times.map((at) => ({ label: dateTime(at), value: toShopInputValue(at.toISOString()) }));
}
