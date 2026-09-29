export const TASK_INBOX_PENDING_COUNTS_KEY = 'engine-workspace.taskInbox.pendingCounts';

export const RETRYABLE_STATES = new Set(['fatal', 'aborted', 'error']);
export const ABORTABLE_STATES = new Set(['running']);
export const TERMINAL_STATES = new Set(['finished', 'fatal', 'aborted', 'error']);
