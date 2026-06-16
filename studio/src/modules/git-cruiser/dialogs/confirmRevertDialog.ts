import type { Bifrost } from '#bifrost/Bifrost';

export async function confirmRevert(bifrost: Bifrost, filePath: string): Promise<boolean> {
  const shouldConfirm = bifrost.settings.get('gitCruiser.confirm.revertFile') !== false;
  if (!shouldConfirm) {
    return true;
  }

  const fileName = filePath.split('/').pop() ?? filePath;

  const result = await bifrost.dialog.open({
    title: 'Revert Changes',
    content: [
      {
        type: 'text',
        text: `Are you sure you want to revert all changes to \`${fileName}\`?\nThis action cannot be undone.`,
      },
      { type: 'divider' },
      {
        type: 'checkbox',
        id: 'doNotAskAgain',
        label: `Don't ask again`,
      },
    ],
    actions: [
      { label: 'Cancel', response: 'cancel', cancel: true },
      { label: 'Revert', response: 'revert', dangerous: true, default: true },
    ],
  });

  if (result.formData?.doNotAskAgain === true) {
    bifrost.settings.set('gitCruiser.confirm.revertFile', false);
  }

  return result?.response === 'revert';
}
