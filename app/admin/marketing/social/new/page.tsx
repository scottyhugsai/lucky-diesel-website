import { Card, PageHeader } from '@/components/app/ui';
import { SectionTabs } from '@/components/admin/marketing/studio/Bits';
import { SOCIAL_TABS } from '@/components/admin/marketing/studio/labels';
import { PostEditor } from '@/components/admin/marketing/studio/PostEditor';
import { pickerOptions, timeSuggestions } from '@/components/admin/marketing/studio/post-editor-data';
import { requireRole } from '@/lib/auth';
import { savePost, writeCaption } from '../actions';

export const metadata = { title: 'New post | Lucky Diesel admin' };

export default async function NewPostPage() {
  await requireRole('admin');
  const [images, suggestions] = await Promise.all([pickerOptions(null), timeSuggestions('instagram')]);
  return (
    <>
      <PageHeader kicker="Marketing · Social" title="New post" description="Write once, post to every network." />
      <SectionTabs tabs={SOCIAL_TABS} active="/admin/marketing/social/new" />
      <Card>
        <PostEditor
          draft={{ id: null, title: '', caption: '', hashtags: '#LuckyDiesel #Charleston', networks: ['instagram', 'facebook'], scheduledFor: suggestions[0]?.value ?? '', image: 'template:seasonal' }}
          images={images}
          suggestions={suggestions}
          save={savePost}
          write={writeCaption}
        />
      </Card>
    </>
  );
}
