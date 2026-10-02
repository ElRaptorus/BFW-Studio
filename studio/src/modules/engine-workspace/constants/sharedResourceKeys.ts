export const TASK_INBOX_PENDING_COUNTS_KEY = 'engine-workspace.taskInbox.pendingCounts';

export const RETRYABLE_STATES = new Set(['fatal', 'aborted', 'error']);
export const ABORTABLE_STATES = new Set(['running']);
/** The Engine's delete accepts exactly these states (`BfwEngine.Api`); `cancelled` transaction children are rejected. */
export const DELETABLE_STATES = new Set(['finished', 'fatal', 'aborted', 'error', 'escalated', 'compensated']);
