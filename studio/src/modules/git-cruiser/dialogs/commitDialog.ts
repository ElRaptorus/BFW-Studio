import type { Bifrost } from '#bifrost/Bifrost';

import type { GitCommitOptions } from '../GitTypes';

export async function openCommitDialog(
  bifrost: Bifrost,
  defaultTitle?: string,
  summary?: string,
): Promise<GitCommitOptions | null> {
  const contentItems: any[] = [
    {
      type: 'text_input',
      id: 'commitTitle',
      label: 'Commit Title',
      placeholder: 'Summary of changes...',
      value: defaultTitle ?? '',
      focus: true,
    },
    {
      type: 'text_input',
      id: 'commitBody',
      label: 'Commit Body (optional)',
      placeholder: 'Detailed description...',
    },
  ];

  if (summary) {
    contentItems.push({
      type: 'markdown',
      text: summary,
    });
  }

  const result = await bifrost.dialog.open({
    title: 'Git Commit',
    content: contentItems,
    actions: [
      { label: 'Cancel', response: 'cancel', cancel: true },
      { label: 'Commit', response: 'commit', default: true },
    ],
  });

  if (result?.wasCancelled || result?.response !== 'commit') {
    return null;
  }

  const title = result.formData?.commitTitle?.trim();
  if (!title) {
    return null;
  }

  return {
    title,
    body: result.formData?.commitBody?.trim() || undefined,
  };
}
