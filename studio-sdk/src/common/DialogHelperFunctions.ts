import type {
  DialogFormData,
  DialogResult,
  DialogValidationCallbackFn,
  DialogValidationResult,
} from '../contracts/DialogTypes';
import { StandardDialogResponse } from '../contracts/DialogTypes';
import { assertNotNull } from './AssertionFunctions';

type FormDataValidationCallbackFn = (formData: DialogFormData) => Promise<DialogValidationResult>;

export function validateFormDataOnSubmit(
  ...dialogValidationCallbackFns: FormDataValidationCallbackFn[]
): DialogValidationCallbackFn {
  return validateFormDataOn(StandardDialogResponse.Submit, ...dialogValidationCallbackFns);
}

export function validateFormDataOn(
  response: StandardDialogResponse | string,
  ...dialogValidationCallbackFns: FormDataValidationCallbackFn[]
): DialogValidationCallbackFn {
  return async (dialogResult: DialogResult) => {
    if (dialogResult.response !== response) {
      return { closeDialog: true };
    }

    const formData = dialogResult.formData;
    assertNotNull(formData, 'formData');

    let memo: DialogValidationResult = { closeDialog: true };

    for (const formDataValidationFn of dialogValidationCallbackFns) {
      const currentPropertyValidationResult = await formDataValidationFn(formData);
      if (currentPropertyValidationResult.closeDialog === false) {
        const previousValidationErrors = memo.closeDialog === true ? [] : memo.validationErrors;
        const validationErrors = currentPropertyValidationResult.validationErrors;

        memo = { closeDialog: false, validationErrors: [...previousValidationErrors, ...validationErrors] };
      }
    }

    return memo;
  };
}

export function validateFormData(
  contentId: string,
  errorLabel: string,
  validateFn: (contentValue: any) => Promise<boolean>,
): FormDataValidationCallbackFn {
  return async (formData: DialogFormData): Promise<DialogValidationResult> => {
    const contentValue = formData[contentId];
    const contentIsValid = await validateFn(contentValue);

    if (contentIsValid === true) {
      return { closeDialog: true };
    } else if (contentIsValid === false) {
      return { closeDialog: false, validationErrors: [{ contentId, errorLabel }] };
    } else {
      throw new Error(
        `Unexpected value: Validation function was supposed to return true or false, got: ${contentIsValid}`,
      );
    }
  };
}

export function validateFormDataIsNotEmpty(contentId: string, errorMessage: string): FormDataValidationCallbackFn {
  return validateFormData(contentId, errorMessage, async (contentValue) => contentValue?.trim() !== '');
}
