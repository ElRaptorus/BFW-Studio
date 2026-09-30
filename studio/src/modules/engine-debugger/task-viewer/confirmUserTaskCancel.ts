import type { DialogOptions, DialogResult } from '#bifrost/contracts/DialogTypes';

export async function confirmUserTaskCancel(
  openDialog: (options: DialogOptions) => Promise<DialogResult>,
): Promise<boolean> {
  const dialogResult = await openDialog({
    title: 'Cancel User Task',
    content:
      'Cancelling this User Task aborts the whole process instance, including its parent and child process instances. Error boundary events do not catch it.',
    actions: [
      { label: 'Keep Task', response: 'keep', cancel: true, default: true },
      { label: 'Cancel User Task', response: 'cancel-user-task', dangerous: true },
    ],
  });

  return dialogResult.response === 'cancel-user-task';
}
