import { marked } from 'marked';

import type { ChangeEvent } from 'react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import type {
  DialogActionObject,
  DialogContentObject,
  DialogContentObject_Checkbox,
  DialogContentObject_Diff,
  DialogContentObject_Divider,
  DialogContentObject_Json,
  DialogContentObject_KeyValueBuilder,
  DialogContentObject_Markdown,
  DialogContentObject_MarkdownEditor,
  DialogContentObject_PathList,
  DialogContentObject_PathPicker,
  DialogContentObject_ResponseLink,
  DialogContentObject_Section,
  DialogContentObject_Select,
  DialogContentObject_Text,
  DialogContentObject_TextInput,
  DialogContentStrict,
  DialogFormData,
  DialogOptionsStrict,
  DialogOptionsStrict_Custom,
  DialogOptionsStrict_MessageBox,
  DialogResponseCallbackFn,
  DialogResult,
  DialogValidationError,
  DialogValidationResult,
  IconComponent,
} from '@evil/bifrost_fw_sdk';
import {
  Checkbox,
  DiffEditor,
  MarkdownEditor,
  MultiLineCodeEditor,
  assertNotNull,
  showContextMenu,
} from '@evil/bifrost_fw_sdk';

import { DIALOG_RESPONSE_CANCEL } from '../../../../studio-sdk/src/contracts/internal/DialogEvents';
import { useBifrost } from '../../bifrostContext';

type DialogRendererProps = {
  options: DialogOptionsStrict;

  // used in docs/machine-sanctum, prevents focussing the `default` action
  noFocus?: boolean;

  responseCallback?: DialogResponseCallbackFn;
  validationResult?: DialogValidationResult;
  iconComponent: IconComponent;
};

type DialogContentProps = {
  content: DialogContentStrict;
  noFocus?: boolean;
  iconComponent: IconComponent;
  responseCallback: PreliminaryDialogResponseCallbackFn;
  validationResult?: DialogValidationResult;
  onSelectChange: OnDialogContentSelectChangeCallbackFn;
  codeEditorRefRegistrator: (ref: React.RefObject<MultiLineCodeEditor | DiffEditor | null>) => void;
};

type DialogActionProps = {
  response: string;
  label?: string;
  default?: boolean;
  dangerous?: boolean;
  cancel?: boolean;
  disabled?: boolean;
  noFocus: boolean;
  responseCallback: PreliminaryDialogResponseCallbackFn;
};

type WithIconAndResponseProps = {
  iconComponent: IconComponent;
  responseCallback: PreliminaryDialogResponseCallbackFn;
};

type DialogContentObject_JsonProps = DialogContentObject_Json & {
  noFocus?: boolean;
  dialogContent: DialogContentStrict;
  htmlRefRegistrator: (ref: React.RefObject<MultiLineCodeEditor | null>) => void;
};

type DialogContentObject_DiffProps = DialogContentObject_Diff & {
  noFocus?: boolean;
  dialogContent: DialogContentStrict;
  htmlRefRegistrator: (ref: React.RefObject<DiffEditor | null>) => void;
};

type DialogContentObject_MarkdownEditorProps = DialogContentObject_MarkdownEditor & {
  noFocus?: boolean;
  dialogContent: DialogContentStrict;
};

type DialogContentObject_TextInputProps = DialogContentObject_TextInput & {
  noFocus?: boolean;
  dialogContent: DialogContentStrict;
};

type DialogContentObject_SelectProps = DialogContentObject_Select & {
  onChange: OnDialogContentSelectChangeCallbackFn;
};

type PreliminaryDialogResponseCallbackFn = (response: string, mergeFormData?: any) => void;
type OnDialogContentSelectChangeCallbackFn = (id: string, value: string) => void;

const DEFAULT_RESPONSE_CALLBACK: DialogResponseCallbackFn = async (dialogResult: DialogResult): Promise<void> =>
  console.log('DialogRenderer: No responseCallback for action ', dialogResult);

function getValidationErrorsForContent(
  validationResult: DialogValidationResult | undefined,
  contentId: string,
): DialogValidationError[] {
  if (validationResult != null && validationResult.closeDialog === false) {
    return validationResult.validationErrors.filter((e) => e.contentId === contentId);
  }
  return [];
}

export default function DialogRenderer(props: DialogRendererProps): React.JSX.Element {
  if (props.options.type !== 'custom' && props.options.type !== 'message-box') {
    throw new Error(`The renderer does not support rendering this dialog type: ${props.options.type}`);
  }

  const defaultResponse = props.options.actions.find((action: any) => action.default)?.response;

  const [codeEditorRefs, setCodeEditorRefs] = useState<React.RefObject<MultiLineCodeEditor | DiffEditor | null>[]>([]);
  const [content, setContent] = useState(props.options.content);
  const formRef = useRef<HTMLFormElement>(null);

  const responseCallback = useRef(props.responseCallback || DEFAULT_RESPONSE_CALLBACK).current;

  const formToPojo = useCallback(
    (form: HTMLFormElement): DialogFormData => {
      const obj: DialogFormData = {};
      const elements = form.querySelectorAll('input, select, textarea') as any;
      for (const element of elements) {
        const name = element.name;
        const value = element.type === 'checkbox' ? element.checked : element.value;

        if (name) {
          obj[name] = value;
        }
      }

      for (const codeEditorRef of codeEditorRefs) {
        const name = codeEditorRef.current?.name;
        const value = codeEditorRef.current?.getCurrentValue();

        if (name) {
          obj[name] = value;
        }
      }

      return obj;
    },
    [codeEditorRefs],
  );

  const preliminaryResponseCallback = useCallback(
    (response: string, mergeFormData?: any) => {
      let dialogResult: DialogResult;

      if (response === DIALOG_RESPONSE_CANCEL) {
        dialogResult = { wasCancelled: true };
      } else {
        const options = props.options as DialogOptionsStrict_Custom | DialogOptionsStrict_MessageBox;
        const action = options.actions.find((action) => action.response === response);
        const form = formRef.current as HTMLFormElement;
        const formData = formToPojo(form);

        if (typeof response !== 'string') {
          throw new Error(
            `Unexpected value: \`response\` was expected to be a string, got: ${JSON.stringify(response)}`,
          );
        }

        dialogResult = { wasCancelled: action?.cancel === true, response, formData };
      }

      responseCallback(dialogResult);
    },
    [props.options, responseCallback, formToPojo],
  );

  const onDialogContentSelectChange = useCallback(
    (id: string, value: string) => {
      const newContent = content.map((contentObject) => {
        if (contentObject.type === 'select' && contentObject.id === id) {
          const newContentObject = { ...contentObject, value: value };
          return newContentObject;
        }

        return contentObject;
      });

      // JSON.stringify for equality: acceptable here since dialog content arrays are small (2-5 items).
      if (JSON.stringify(content) !== JSON.stringify(newContent)) {
        setContent(newContent);
      }
    },
    [content],
  );

  useEffect(() => {
    // Hitting ENTER in an input field inside the <form> node would normally submit the form in a browser.
    // To emulate this behaviour, we trigger the default action of the dialog.
    const form = formRef.current;
    if (form == null || defaultResponse == null) {
      return;
    }

    let submittable = false;

    const onSubmit = (event: Event) => {
      event.preventDefault();
      if (submittable) {
        preliminaryResponseCallback(defaultResponse);
      }
    };

    form.addEventListener('submit', onSubmit);

    // When a dialog is triggered via the command search by pressing ENTER, this handler is accidentally triggered.
    // Therefore we prevent submitting for the current "tick".
    const timeout = setTimeout(() => (submittable = true), 1);

    return () => {
      form.removeEventListener('submit', onSubmit);
      clearTimeout(timeout);
    };
  }, [defaultResponse, preliminaryResponseCallback]);

  const [prevOptions, setPrevOptions] = useState(props.options);
  if (props.options !== prevOptions) {
    setPrevOptions(props.options);
    if (props.options.type === 'custom') {
      setContent(props.options.content);
    }
  }

  return (
    <div
      className={`modal-dialog modal-dialog-centered ${props.options.type === 'custom' ? props.options.className : ''}`}
      role="document"
    >
      <div className="modal-content">
        <div className="modal-content__inner">
          <div className="modal-header">
            <h5 className="modal-title">{props.options.type === 'custom' ? props.options.title : null}</h5>
            {!(props.options.type === 'custom' && props.options.hideCloseButton) && (
              <span
                className="dialog__close-button"
                onClick={() => preliminaryResponseCallback(DIALOG_RESPONSE_CANCEL)}
              >
                <span className="ph ph-x" />
              </span>
            )}
          </div>
          <div className="modal-body">
            <form ref={formRef}>
              <DialogContent
                content={content}
                iconComponent={props.iconComponent}
                noFocus={props.noFocus}
                responseCallback={preliminaryResponseCallback}
                validationResult={props.validationResult}
                onSelectChange={onDialogContentSelectChange}
                codeEditorRefRegistrator={(ref: React.RefObject<MultiLineCodeEditor | DiffEditor | null>) =>
                  setCodeEditorRefs((prev) => (prev.includes(ref) ? prev : [...prev, ref]))
                }
              />
            </form>
          </div>
          {props.options.actions.length > 0 && (
            <div className="modal-footer">
              {props.options.actions.map((actionProps: DialogActionObject) => (
                <DialogAction
                  noFocus={props.noFocus || (Array.isArray(content) && content.some((item: any) => item.focus))}
                  key={actionProps.response}
                  responseCallback={preliminaryResponseCallback}
                  {...actionProps}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DialogAction(props: DialogActionProps): React.JSX.Element {
  const label = props.label || getActionLabel(props.response);
  let className = 'btn';

  if (props.default) {
    className += ' dialog-btn--primary';
  } else if (props.dangerous) {
    className += ' dialog-btn--dangerous';
  } else {
    className += ' dialog-btn--secondary';
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() => props.responseCallback(props.response)}
      autoFocus={props.default && !props.noFocus}
      disabled={props.disabled}
    >
      {label}
    </button>
  );
}

function DialogContent(props: DialogContentProps): React.JSX.Element {
  if (typeof props.content === 'string' || !Array.isArray(props.content)) {
    throw new Error('Unexpected error: `content` is formatted wrong (should be an array of DialogContentObjects)');
  }

  return (
    <>
      {props.content.map((content: DialogContentObject, index: number) => {
        switch (content.type) {
          case 'checkbox':
            return <DialogContentCheckbox key={index} {...content} />;
          case 'markdown':
            return <DialogContentMarkdown key={index} {...content} />;
          case 'text':
            return <DialogContentText key={index} {...content} />;
          case 'divider':
            return <DialogContentDivider key={index} {...content} />;
          case 'section':
            return <DialogContentSection key={index} {...content} />;
          case 'response_link':
            return (
              <DialogContentResponseLink
                key={index}
                iconComponent={props.iconComponent}
                responseCallback={props.responseCallback}
                {...content}
              />
            );
          case 'markdown_container':
            return (
              <DialogContentMarkdownEditor
                key={index}
                noFocus={props.noFocus}
                {...content}
                dialogContent={props.content}
              />
            );
          case 'json':
            return (
              <DialogContentJson
                key={index}
                noFocus={props.noFocus}
                validationErrors={getValidationErrorsForContent(props.validationResult, content.id)}
                {...content}
                dialogContent={props.content}
                htmlRefRegistrator={(ref: React.RefObject<MultiLineCodeEditor | null>) => {
                  props.codeEditorRefRegistrator(ref);
                }}
              />
            );
          case 'diff':
            return (
              <DialogContentDiff
                key={index}
                noFocus={props.noFocus}
                validationErrors={getValidationErrorsForContent(props.validationResult, content.id)}
                {...content}
                dialogContent={props.content}
                htmlRefRegistrator={(ref: React.RefObject<DiffEditor | null>) => {
                  props.codeEditorRefRegistrator(ref);
                }}
              />
            );
          case 'select':
            return (
              <DialogContentSelect
                key={index}
                validationErrors={getValidationErrorsForContent(props.validationResult, content.id)}
                {...content}
                onChange={props.onSelectChange}
              />
            );
          case 'text_input':
            return (
              <DialogContentTextInput
                key={index}
                noFocus={props.noFocus}
                validationErrors={getValidationErrorsForContent(props.validationResult, content.id)}
                {...content}
                dialogContent={props.content}
              />
            );
          case 'path_list':
            return (
              <DialogContentPathList
                key={index}
                validationErrors={getValidationErrorsForContent(props.validationResult, content.id)}
                {...content}
              />
            );
          case 'path_picker':
            return (
              <DialogContentPathPicker
                key={index}
                validationErrors={getValidationErrorsForContent(props.validationResult, content.id)}
                {...content}
              />
            );
          case 'key_value_builder':
            return (
              <DialogContentKeyValueBuilder
                key={index}
                validationErrors={getValidationErrorsForContent(props.validationResult, content.id)}
                {...content}
              />
            );
          default:
            throw new Error(
              `Unexpected error: content type could not be rendered: ${JSON.stringify(content, null, 2)}`,
            );
        }
      })}
    </>
  );
}

function DialogContentText(props: DialogContentObject_Text): React.JSX.Element {
  return <p>{props.text}</p>;
}

function DialogContentMarkdown(props: DialogContentObject_Markdown): React.JSX.Element {
  const html = marked(props.text, { async: false }) as string;

  return <div className="dialog-markdown" dangerouslySetInnerHTML={{ __html: html }} />;
}

function DialogContentDivider(props: DialogContentObject_Divider): React.JSX.Element {
  return <div className="modal__divider" />;
}

function DialogContentResponseLink(
  props: DialogContentObject_ResponseLink & WithIconAndResponseProps,
): React.JSX.Element {
  const Icon = props.iconComponent;
  const onClick = () => props.responseCallback(props.response);

  return (
    <div className="response-link" onClick={onClick}>
      {props.icon && (
        <div className="response-link__icon">
          <Icon id={props.icon} />
        </div>
      )}
      <div className="response-link__text">
        <div className="response-link__label">{props.label}</div>
        {props.sublabel && <div className="response-link__sublabel">{props.sublabel}</div>}
      </div>
    </div>
  );
}

function DialogContentSection(props: DialogContentObject_Section): React.JSX.Element {
  return <div className="modal__section">{props.text}</div>;
}

function DialogContentSelect(props: DialogContentObject_SelectProps): React.JSX.Element {
  const validationErrors = props.validationErrors ?? [];
  const hasErrors = validationErrors.length > 0;

  return (
    <div className="modal__text-input">
      <div className="form-group">
        {props.label && <label className="text-input__label">{props.label}</label>}

        <select
          className={`form-control text-input__input ${hasErrors ? 'is-invalid' : ''}`}
          name={props.id}
          defaultValue={props.value}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => props.onChange(props.id, event.target.value)}
        >
          {props.entries.map((entry: any, index: number) => (
            <option key={`${index}_${entry.value}_${entry.label}`} value={entry.value}>
              {entry.label}
            </option>
          ))}
        </select>

        {hasErrors
          ? validationErrors.map((validationError) => (
              <div key={validationError.contentId} className="text-input__validation-error">
                {validationError.errorLabel}
              </div>
            ))
          : null}

        {props.hint && <div className="text-input__hint">{props.hint}</div>}
      </div>
    </div>
  );
}

function DialogContentTextInput(props: DialogContentObject_TextInputProps): React.JSX.Element {
  const { dialogContent, value: valueProp, defaultSelection } = props;
  const [prevDialogContent, setPrevDialogContent] = useState<DialogContentStrict>(dialogContent);
  const htmlElementRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const [value, setValue] = useState(typeof valueProp === 'function' ? valueProp(dialogContent) : valueProp);

  useEffect(() => {
    const selectionRange = defaultSelection;
    if (selectionRange != null) {
      assertNotNull(htmlElementRef.current, 'htmlElementRef.current');

      htmlElementRef.current.setSelectionRange(selectionRange.startIndex, selectionRange.endIndex);
    }
  }, [defaultSelection, htmlElementRef]);

  if (JSON.stringify(dialogContent) !== JSON.stringify(prevDialogContent)) {
    setPrevDialogContent(dialogContent);
    if (typeof valueProp === 'function') {
      setValue(valueProp(dialogContent, value));
    }
  }

  return (
    <div className="modal__text-input">
      <div className="form-group">
        {props.label && <label className="text-input__label">{props.label}</label>}
        {props.multiline ? (
          <textarea
            ref={htmlElementRef as React.RefObject<HTMLTextAreaElement>}
            className={`form-control text-input__input--multiline ${props.validationErrors?.length ? 'is-invalid' : ''}`}
            name={props.id}
            value={value ?? ''}
            placeholder={props.placeholder}
            readOnly={props.readonly}
            autoFocus={!props.noFocus && props.focus}
            onChange={(event) => setValue(event.target.value)}
            onContextMenu={(event) =>
              showContextMenu(event, 'std/component/input/text', [
                event.target,
                props.readonly ? undefined : (value: string) => setValue(value),
              ])
            }
          />
        ) : (
          <input
            ref={htmlElementRef as React.RefObject<HTMLInputElement>}
            type={props.masked ? 'password' : 'text'}
            className={`form-control text-input__input ${props.validationErrors?.length ? 'is-invalid' : ''}`}
            name={props.id}
            value={value ?? ''}
            placeholder={props.placeholder}
            readOnly={props.readonly}
            autoFocus={!props.noFocus && props.focus}
            onChange={(event) => setValue(event.target.value)}
            onContextMenu={(event) =>
              showContextMenu(event, 'std/component/input/text', [
                event.target,
                props.readonly ? undefined : (value: string) => setValue(value),
              ])
            }
          />
        )}

        {props.validationErrors?.map((validationError) => (
          <div key={validationError.contentId} className="text-input__validation-error">
            {validationError.errorLabel}
          </div>
        ))}

        {props.hint && <div className="text-input__hint">{props.hint}</div>}
      </div>
    </div>
  );
}

function DialogContentMarkdownEditor(props: DialogContentObject_MarkdownEditorProps): React.JSX.Element {
  const studio = useBifrost();

  const sizeClass = `dialog-markdown-container pane__textarea--${props.size ?? 'medium'}`;

  return (
    <div className={sizeClass}>
      <MarkdownEditor key={props.id} data={props.text ?? ''} readonly={true} studio={studio} />
    </div>
  );
}

function DialogContentJson(props: DialogContentObject_JsonProps): React.JSX.Element {
  const studio = useBifrost();
  const { dialogContent, value: valueProp, htmlRefRegistrator } = props;

  const [prevDialogContent, setPrevDialogContent] = useState<DialogContentStrict>(dialogContent);
  const htmlElementRef = useRef<MultiLineCodeEditor>(null);

  const [value, setValue] = useState(typeof valueProp === 'function' ? valueProp(dialogContent) : valueProp);

  useEffect(() => {
    htmlRefRegistrator(htmlElementRef);
  }, [htmlElementRef, htmlRefRegistrator]);

  if (JSON.stringify(dialogContent) !== JSON.stringify(prevDialogContent)) {
    setPrevDialogContent(dialogContent);
    if (typeof valueProp === 'function') {
      setValue(valueProp(dialogContent, value));
    }
  }

  return (
    <div className="modal__json">
      <div className="form-group">
        {props.label && <label className="text-input__label">{props.label}</label>}
        <MultiLineCodeEditor
          name={props.id}
          htmlId={props.id}
          ref={htmlElementRef}
          size={(props.size ?? 'medium') as any}
          className={props.validationErrors?.length ? 'is-invalid' : ''}
          initialValue={value ?? ''}
          readOnly={props.readOnly === true}
          autoFocus={!props.noFocus && props.focus}
          language={props.language || 'json'}
          onChange={(newValue) => setValue(newValue)}
          studio={studio}
        />

        {props.validationErrors?.map((validationError) => (
          <div key={validationError.contentId} className="text-input__validation-error">
            {validationError.errorLabel}
          </div>
        ))}

        {props.hint && <div className="text-input__hint">{props.hint}</div>}
      </div>
    </div>
  );
}

function DialogContentDiff(props: DialogContentObject_DiffProps): React.JSX.Element {
  const studio = useBifrost();
  const { dialogContent, beforeValue: beforeValueProp, afterValue: afterValueProp, htmlRefRegistrator } = props;

  const [prevDialogContent, setPrevDialogContent] = useState<DialogContentStrict>(dialogContent);
  const htmlElementRef = useRef<DiffEditor>(null);

  const [beforeValue, setBeforeValue] = useState(
    typeof beforeValueProp === 'function' ? beforeValueProp(dialogContent) : beforeValueProp,
  );

  const [afterValue, setAfterValue] = useState(
    typeof afterValueProp === 'function' ? afterValueProp(dialogContent) : afterValueProp,
  );

  useEffect(() => {
    htmlRefRegistrator(htmlElementRef);
  }, [htmlElementRef, htmlRefRegistrator]);

  if (JSON.stringify(dialogContent) !== JSON.stringify(prevDialogContent)) {
    setPrevDialogContent(dialogContent);
    if (typeof beforeValueProp === 'function') {
      setBeforeValue(beforeValueProp(dialogContent, beforeValue));
    }
    if (typeof afterValueProp === 'function') {
      setAfterValue(afterValueProp(dialogContent, afterValue));
    }
  }

  return (
    <div className="modal__json">
      <div className="form-group">
        {props.label && <label className="text-input__label">{props.label}</label>}
        <DiffEditor
          name={props.id}
          htmlId={props.id}
          ref={htmlElementRef}
          size={(props.size ?? 'medium') as any}
          className={`monaco-diff-editor-wrapper ${props.validationErrors?.length ? 'is-invalid' : ''}`}
          beforeValue={beforeValue ?? ''}
          afterValue={afterValue ?? ''}
          readOnly={props.readOnly === true}
          autoFocus={!props.noFocus && props.focus}
          language={props.language || 'json'}
          studio={studio}
        />

        {props.validationErrors?.map((validationError) => (
          <div key={validationError.contentId} className="text-input__validation-error">
            {validationError.errorLabel}
          </div>
        ))}

        {props.hint && <div className="text-input__hint">{props.hint}</div>}
      </div>
    </div>
  );
}

function DialogContentCheckbox(props: DialogContentObject_Checkbox): React.JSX.Element {
  const [checked, setChecked] = useState(props.checked ?? false);

  return (
    <div className="form-group">
      <Checkbox
        htmlId={props.id}
        checked={checked}
        label={props.label}
        onChange={(event) => setChecked(event.target.checked)}
      />
    </div>
  );
}

type DialogContentObject_PathListProps = DialogContentObject_PathList & {
  validationErrors?: DialogValidationError[];
};

function DialogContentPathList(props: DialogContentObject_PathListProps): React.JSX.Element {
  const bifrost = useBifrost();
  const [paths, setPaths] = useState<string[]>(props.initialValue ?? []);
  const validationErrors = props.validationErrors ?? [];
  const hasErrors = validationErrors.length > 0;

  const addPath = useCallback(async () => {
    const pickerCommand =
      props.mode === 'directory' ? 'std.internal.pickNativeDirectory' : 'std.internal.pickNativeFile';
    if (!bifrost.commands.isRegistered(pickerCommand)) {
      return;
    }

    const selected: string | null = await bifrost.commands.executeCommand(pickerCommand);
    if (selected != null) {
      setPaths((prev) => {
        if (prev.includes(selected)) {
          return prev;
        }
        return [...prev, selected];
      });
    }
  }, [bifrost, props.mode]);

  const removePath = useCallback((index: number) => {
    setPaths((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const addLabel = props.mode === 'directory' ? 'Add folder...' : 'Add file...';

  return (
    <div className="modal__text-input">
      <div className="form-group">
        {props.label && <label className="text-input__label">{props.label}</label>}

        <div className={`dialog-path-list ${hasErrors ? 'is-invalid' : ''}`}>
          {paths.length > 0 && (
            <ul className="dialog-path-list__items">
              {paths.map((path, index) => (
                <li key={`${index}_${path}`} className="dialog-path-list__item">
                  <span className="dialog-path-list__path" title={path}>
                    {path}
                  </span>
                  <span className="dialog-path-list__remove ph ph-x" onClick={() => removePath(index)} />
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="dialog-path-list__add-button" onClick={addPath}>
            + {addLabel}
          </button>
        </div>

        <input type="hidden" name={props.id} value={JSON.stringify(paths)} />

        {hasErrors
          ? validationErrors.map((validationError) => (
              <div key={validationError.contentId} className="text-input__validation-error">
                {validationError.errorLabel}
              </div>
            ))
          : null}

        {props.hint && <div className="text-input__hint">{props.hint}</div>}
      </div>
    </div>
  );
}

type DialogContentObject_PathPickerProps = DialogContentObject_PathPicker & {
  validationErrors?: DialogValidationError[];
};

function DialogContentPathPicker(props: DialogContentObject_PathPickerProps): React.JSX.Element {
  const bifrost = useBifrost();
  const [selectedPath, setSelectedPath] = useState<string>(props.initialValue ?? '');
  const validationErrors = props.validationErrors ?? [];
  const hasErrors = validationErrors.length > 0;

  const pickPath = useCallback(async () => {
    const pickerCommand =
      props.mode === 'directory' ? 'std.internal.pickNativeDirectory' : 'std.internal.pickNativeFile';
    if (!bifrost.commands.isRegistered(pickerCommand)) {
      return;
    }

    const selected: string | null = await bifrost.commands.executeCommand(pickerCommand);
    if (selected != null) {
      setSelectedPath(selected);
    }
  }, [bifrost, props.mode]);

  return (
    <div className="modal__text-input">
      <div className="form-group">
        {props.label && <label className="text-input__label">{props.label}</label>}

        <div
          className={`dialog-path-picker ${hasErrors ? 'is-invalid' : ''}`}
          onClick={pickPath}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              pickPath();
            }
          }}
        >
          {selectedPath ? (
            <span className="dialog-path-picker__path" title={selectedPath}>
              {selectedPath}
            </span>
          ) : (
            <span className="dialog-path-picker__placeholder">
              {props.placeholder ?? (props.mode === 'directory' ? 'Select a folder...' : 'Select a file...')}
            </span>
          )}
          <span className="dialog-path-picker__browse">Browse...</span>
        </div>

        <input type="hidden" name={props.id} value={selectedPath} />

        {hasErrors
          ? validationErrors.map((validationError) => (
              <div key={validationError.contentId} className="text-input__validation-error">
                {validationError.errorLabel}
              </div>
            ))
          : null}

        {props.hint && <div className="text-input__hint">{props.hint}</div>}
      </div>
    </div>
  );
}

type DialogContentObject_KeyValueBuilderProps = DialogContentObject_KeyValueBuilder & {
  validationErrors?: DialogValidationError[];
};

function DialogContentKeyValueBuilder(props: DialogContentObject_KeyValueBuilderProps): React.JSX.Element {
  const [entries, setEntries] = useState<{ key: string; value: string }[]>(
    props.initialEntries ? [...props.initialEntries] : [],
  );
  const validationErrors = props.validationErrors ?? [];
  const hasErrors = validationErrors.length > 0;

  const addEntry = useCallback(() => {
    setEntries((prev) => [...prev, { key: '', value: '' }]);
  }, []);

  const removeEntry = useCallback((index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateEntry = useCallback((index: number, field: 'key' | 'value', newValue: string) => {
    setEntries((prev) => prev.map((entry, i) => (i === index ? { ...entry, [field]: newValue } : entry)));
  }, []);

  return (
    <div className="modal__text-input">
      <div className="form-group">
        {props.label && <label className="text-input__label">{props.label}</label>}

        <div className={`dialog-kv-builder ${hasErrors ? 'is-invalid' : ''}`}>
          {entries.length > 0 && (
            <div className="dialog-kv-builder__header">
              <span className="dialog-kv-builder__col-key">{props.keyLabel ?? 'Key'}</span>
              <span className="dialog-kv-builder__col-sep" />
              <span className="dialog-kv-builder__col-value">{props.valueLabel ?? 'Value'}</span>
              <span className="dialog-kv-builder__col-action" />
            </div>
          )}

          {entries.map((entry, index) => (
            <div key={index} className="dialog-kv-builder__row">
              <input
                type="text"
                className="form-control dialog-kv-builder__input dialog-kv-builder__col-key"
                placeholder={props.keyPlaceholder ?? 'Key'}
                value={entry.key}
                onChange={(e) => updateEntry(index, 'key', e.target.value)}
              />
              <span className="dialog-kv-builder__separator">:</span>
              <input
                type="text"
                className="form-control dialog-kv-builder__input dialog-kv-builder__col-value"
                placeholder={props.valuePlaceholder ?? 'Value'}
                value={entry.value}
                onChange={(e) => updateEntry(index, 'value', e.target.value)}
              />
              <span className="dialog-kv-builder__remove ph ph-trash" onClick={() => removeEntry(index)} />
            </div>
          ))}

          <button type="button" className="dialog-kv-builder__add-button" onClick={addEntry}>
            + Add entry
          </button>
        </div>

        <input type="hidden" name={props.id} value={JSON.stringify(entries)} />

        {hasErrors
          ? validationErrors.map((validationError) => (
              <div key={validationError.contentId} className="text-input__validation-error">
                {validationError.errorLabel}
              </div>
            ))
          : null}

        {props.hint && <div className="text-input__hint">{props.hint}</div>}
      </div>
    </div>
  );
}

function getActionLabel(name: string): string {
  const [first, ...rest] = name.split('_');
  const capitalize = (str: string): string => str.charAt(0).toUpperCase() + str.substring(1);
  const title = rest
    .map((part) => capitalize(part))
    .join(' ')
    .replace(/-/g, ' ');

  return capitalize(first) + ' ' + title;
}
