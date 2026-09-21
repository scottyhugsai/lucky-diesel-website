import { notFound } from 'next/navigation';
import { ogAlt, ogImage, size, contentType } from '@/lib/og';
import { siteUrl } from '@/lib/site-url';
import { createClient } from '@/lib/supabase/server';

export { size, contentType };
export const alt = ogAlt('Build');

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const supabase = await createClient();
  const { data: build } = await supabase
    .from('builds')
    .select('title, vehicle_label, before_hp, after_hp, hero_image, is_sample')
    .eq('slug', (await params).slug)
    .eq('published', true)
    .maybeSingle();
  if (!build) notFound();

  const gain = build.before_hp && build.after_hp ? build.after_hp - build.before_hp : null;
  // A dyno figure leaving the site in a share preview has to carry the same
  // label it carries on the page, or the card becomes the shop's claim.
  const subtitle = build.is_sample
    ? `Example build${gain !== null ? ` · +${gain} hp` : ''}`
    : [build.vehicle_label, gain !== null ? `+${gain} hp` : null].filter(Boolean).join(' · ');

  return ogImage({
    eyebrow: build.is_sample ? 'Example build' : 'From the shop',
    title: build.title,
    subtitle: subtitle || undefined,
    image: build.hero_image?.startsWith('/') ? `${siteUrl()}${build.hero_image}` : build.hero_image ?? undefined,
  });
}
