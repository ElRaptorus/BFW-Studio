export type PropertyValidationFn = (value: any) => PropertyValidationResult;

export type PropertyValidationResult = PropertyValidationResult_Success | PropertyValidationResult_Failure;

type PropertyValidationResult_Success = [];
type PropertyValidationResult_Failure = string[];

export function combinePropertyValidators(...propertyValidationFns: PropertyValidationFn[]): PropertyValidationFn {
  return (value: any): PropertyValidationResult => {
    const allValidationErrors: string[] = [];
    propertyValidationFns.forEach((propertyValidationFn) => {
      const validationErrors = propertyValidationFn(value);

      allValidationErrors.push(...validationErrors);
    });
    return allValidationErrors;
  };
}

export function validatePropertyNotEmpty(errorMessage: string): PropertyValidationFn {
  return (value: string): PropertyValidationResult => {
    if (value.trim() === '') {
      return [errorMessage];
    } else {
      return [];
    }
  };
}

export function validatePropertyMatching(errorMessage: string, regex: RegExp): PropertyValidationFn {
  return (value: string): PropertyValidationResult => {
    if (regex.test(value)) {
      return [];
    } else {
      return [errorMessage];
    }
  };
}

export function validateProperty(errorMessage: string, callbackFn: (value: any) => boolean): PropertyValidationFn {
  return (value: string): PropertyValidationResult => {
    if (callbackFn(value)) {
      return [];
    } else {
      return [errorMessage];
    }
  };
}
