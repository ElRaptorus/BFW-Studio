# BPMN Editor Property Panes

---

## Overview

The BPMN editor exposes element-specific property panes in the right pane area. Panes are grouped into three categories (`property`, `scripting`, `documentation`) and registered via `initializeBpmnPanes.ts`. Each pane implements the `PaneProvider` contract and uses `BpmnDocumentElementAccess` to read/write element data through the bpmn-js modeler's command stack.

---

## Architecture

### Pane Group Structure

The BPMN editor registers panes into three groups on the `right` pane area:

| Group | Purpose | Examples |
|-------|---------|----------|
| `property` | Static/structural element properties | Element info, element ID, name, message/signal references, HTTP task config, loop/MI config, user task form fields, business rule task, call activity |
| `scripting` | Runtime-evaluated content | Data pipeline mappings and contracts, data output association transformations, example payloads, custom tokens, custom attributes |
| `documentation` | Documentation viewing/editing | Element documentation (MarkdownEditor) |

When a BPMN element is selected:
- The `property` group is the default active group
- If 2+ groups have displayable panes, an icon-based tab bar appears above the panes
- Each pane's `shouldBeDisplayed(editorDocument, editorDocumentModel)` determines visibility

The general pane contract (`shouldBeDisplayed` vs renderer, `PaneWrapper` gating, data access) is documented in **[panes.md](panes.md)**. BPMN-specific helpers live in `PropertiesPaneFunctions.ts` (`shouldBeDisplayedForBpmnElementOfType` and related type lists). Those helpers check document type and selection only. Modeler `isReadyForInteraction()` is handled in `getBpmnSelectionForPropertiesPane`, which returns `null` so the pane header can still show while the body is empty.

### PaneProvider Contract

Every property pane exports a `paneProvider: PaneProvider` object:

```typescript
export const paneProvider: PaneProvider = {
  getPaneTitle: () => string,
  shouldBeDisplayed: (editorDocument, editorDocumentModel) => boolean,
  Pane: (props: PaneComponentProps) => JSX.Element,      // Full pane (header + body)
  PaneContent: (props: PaneComponentProps) => JSX.Element, // Body only
};
```

`shouldBeDisplayed` is the only wrapper visibility gate. `PaneWrapper` does not mount `Pane` / `PaneContent` when it returns `false`. Renderers must not restate type, selection, or document-URI checks that the gate already proved. A renderer may still `return null` for conditions the gate does not cover (modeler readiness, missing payload). Use `assertNotNull` only for data the gate proved.

### PropertiesElementInfo — Consolidated Help Pane

**Path:** `studio/src/modules/bpmn-editor/panes/properties/PropertiesElementInfo.tsx`

Replaces ~30 individual help-only panes. Contains an `elementInfoMap: Record<string, ElementInfoEntry>` mapping `BpmnElementType` values to `{ title, description, helpId }`. The pane title is dynamic, matching the selected element type (e.g., "Exclusive Gateway", "User Task"). Special handling for parallel multi-instance elements returns a dedicated info entry.

### Subprocess Plane Behavior

When the user drills into a collapsed subprocess, top-level panes are hidden and a dedicated context pane appears. See **[bpmn-drilldown.md](bpmn-drilldown.md)** for the full integration.

| Pane | Inside subprocess |
|------|-------------------|
| `PropertiesDefinition` | Hidden |
| `PropertiesProcess` | Hidden |
| `PropertiesProcesses` | Hidden |
| `PropertiesSubprocessContext` | Shown (no selection) — subprocess name, ID, loop config, "Back to parent" |

Panes that depend on element enumeration use `getVisibleElements()` (plane-scoped) instead of `getAllElements()` (cross-plane).

`isInsideSubprocessPlane()` (in `BpmnDocumentModel.ts` / `ModelViewerDocumentModel.ts`) uses `businessObject.$instanceOf('bpmn:SubProcess')` rather than a strict `$type` check, so Transaction and Ad-hoc Sub-Process planes are recognized identically to plain embedded subprocesses. `PropertiesSubprocessContext` additionally detects `BpmnElementType.AdHocSubprocess` and shows the current `ordering` and `completionCondition` (read-only) alongside the usual name/ID/loop-config fields.

### Property Read/Write Flow

```
┌─────────────┐     setElementProperty(id, prop, value)     ┌─────────────────────────┐
│  Pane (TSX)  │ ─────────────────────────────────────────▶  │ BpmnDocumentElementAccess│
└─────────────┘                                              └───────────┬─────────────┘
                                                                         │
                                                    setHandlers[prop](element, prop, value)
                                                                         │
                                                                         ▼
                                                              ┌──────────────────┐
                                                              │   CmdHelper.*    │
                                                              │  (descriptor)    │
                                                              └────────┬─────────┘
                                                                       │
                                                          commandStack.execute(cmd, context)
                                                                       │
                                                                       ▼
                                                              ┌──────────────────┐
                                                              │ Command Handler  │
                                                              │  (diagram-js)   │
                                                              └──────────────────┘
```

#### BpmnDocumentElementAccess

**Path:** `studio/src/modules/bpmn-editor/BpmnDocumentElementAccess.ts`

The bridge between typed `BpmnElement` model and the bpmn-js modeler. Key handler maps:

| Handler map | Purpose |
|-------------|---------|
| `setHandlers` | Write: dispatches `setElementProperty(id, propertyName, value)` to the correct command |
| `getHandlers` | Read: extracts typed values from `element.businessObject` |
| `castElement()` | Converts a raw modeler element to a typed `BpmnElement` union |

Notable set handlers:

| Property name | Handler | Command |
|---------------|---------|---------|
| `serviceTaskImplementation` | Sets `implementation` attribute via `UpdateServiceTaskHandler` | `UpdateServiceTaskHandler` |
| `loopConfig` | Creates/updates loop characteristics elements | `UpdateLoopCharacteristicsHandler` |
| `userTaskResources` | Manages `bpmn:HumanPerformer` / `bpmn:PotentialOwner` | `UpdateUserTaskResourcesHandler` |
| `correlationRetrievalExpression` | Sets `evil:CorrelationRetrievalExpression` on `MessageEventDefinition` or element | `UpdateCorrelationRetrievalExpressionHandler` |
| `activationCondition` | Creates/updates/clears the standard `<bpmn:activationCondition>` child (a `bpmn:FormalExpression`) on a Complex Gateway; mirrors the `transformation` handler | `modeling.updateProperties` |

The matching `getHandlers.activationCondition` returns `element.businessObject.activationCondition?.body`. Both handlers follow the same pattern as `transformation`/`conditionExpression`: write creates a `bpmn:FormalExpression { body }` (or `undefined` to remove the child), read returns the child's `body` text. The engine parses this element as trimmed body text (see `docs/architecture/engine.md` §Complex Gateway).

`castCustomProperty` and `castDataPipelineMapping` stamp a stable `rowId` on the live moddle object via WeakMaps (`customPropertyRowIds`, `dataPipelineMappingRowIds`). Pane lists must use that `rowId` as the React `key`, not the live name/source/target text.

### Command Handlers

#### UpdateLoopCharacteristicsHandler

**Path:** `studio/src/modules/bpmn-core/bpmn-js/CommandHandler/UpdateLoopCharacteristicsHandler.ts`

Handles creation and modification of `bpmn:StandardLoopCharacteristics` and `bpmn:MultiInstanceLoopCharacteristics` elements. Commands:

| Sub-command | What it updates |
|-------------|----------------|
| `updateStandardLoop` | `loopCondition` (FormalExpression body), `loopMaximum`, `testBefore` (standard BPMN attribute), `evil:LoopInterval` (evil extension) |
| `updateMultiInstance` | `completionCondition` (FormalExpression), `inputDataItem` (DataInput), `outputDataItem` (DataOutput), `evil:ElementVariable`, `evil:OutputElementVariable`, `evil:LoopBreakCondition`, `evil:LoopInterval`, `evil:MaxIterations` (evil extensions). `loopCardinality` is no longer supported. The editor splits these across two panes: `PropertiesSequentialMiSettings` (Break Condition, Loop Interval, Max Iterations — sequential MI only) and `PropertiesParallelMiSettings` (Max Iterations — parallel MI only). |

#### UpdateUserTaskResourcesHandler

**Path:** `studio/src/modules/bpmn-core/bpmn-js/CommandHandler/UpdateUserTaskResourcesHandler.ts`

Manages the `resources` array on user task business objects. Creates or updates:
- `bpmn:HumanPerformer` → contains `bpmn:ResourceAssignmentExpression` → body = assignee value
- `bpmn:PotentialOwner` → contains `bpmn:ResourceAssignmentExpression` → body = candidate users value

#### UpdateServiceTaskHandler

**Path:** `studio/src/modules/bpmn-core/bpmn-js/CommandHandler/UpdateServiceTaskHandler.ts`

Switches service task implementation type via the `implementation` attribute:

| Implementation value | Service task type |
|---------------------|-------------------|
| `"http"` | HTTP Service Task |
| (empty/absent) | Generic (unconfigured) |
| (custom string) | Plugin-registered custom service task type |

#### UpdateCorrelationRetrievalExpressionHandler

**Path:** `studio/src/modules/bpmn-core/bpmn-js/CommandHandler/UpdateCorrelationRetrievalExpressionHandler.ts`

Persists `evil:CorrelationRetrievalExpression` for catch-side message elements. The handler navigates from the BPMN element to its `MessageEventDefinition` child (for events) or targets the element directly (for `ReceiveTask`), then uses `setEvilBodyExtension` to create/update/clear the extension element.

#### UpdateAdHocSubprocessHandler

**Path:** `studio/src/modules/bpmn-core/bpmn-js/CommandHandler/UpdateAdHocSubprocessHandler.ts`

Persists all `bpmn:AdHocSubProcess`-specific properties. Invoked via `CmdHelper.updateAdHocSubprocess(element, changes)`.

| Property | Storage |
|----------|---------|
| `ordering` | Direct attribute on the business object (`Parallel` \| `Sequential`) |
| `cancelRemainingInstances` | Direct boolean attribute on the business object |
| `implementation` | Direct attribute on the business object (empty/absent = engine-managed mode) |
| `completionCondition` | `bpmn:FormalExpression` child element (same pattern as Loop/MI completion condition) |
| `activeElementsExpression` | `evil:ActiveElements` extension element body via `setEvilBodyExtension` |

The pane (`PropertiesAdHocSubprocess`, path `studio/src/modules/bpmn-editor/panes/properties/AdHocSubprocess/PropertiesAdHocSubprocess.tsx`) shows all five properties. `activeElementsExpression` uses the standard FEEL expression context (`bpmn.feel.getExpressionContext`). `completionCondition` uses a dedicated, narrower variable set (`ADHOC_COMPLETION_CONDITION_VARIABLES`: `performedActivities`, `activeCount`, `totalActivities`) because the engine evaluates it against `AdHocMode`'s dedicated completion bindings, not the standard token/context/this bindings — mixing in the standard bindings would suggest availability that does not exist at runtime.

### Service Task Implementation Model

The BPMN 2.0 `implementation` attribute on `<bpmn:serviceTask>` replaced the legacy `BpmnServiceTaskType` enum and Camunda-specific `camunda:type` / `camunda:module` attributes. Built-in HTTP tasks use `"http"`; other values are free-text plugin dispatch keys.

```typescript
export const BpmnServiceTaskImplementation = {
  Http: 'http',
  Unspecified: '##unspecified',
} as const;
```

Detection utilities in `Utils.ts` check `element.businessObject.get('implementation')` directly.

---

## Pane Registration

**Path:** `studio/src/modules/bpmn-editor/initializers/initializeBpmnPanes.ts`

Uses `bifrost.panes.prependToPaneGroup(area, groupId, panes[])`. Pane order within the array determines top-to-bottom display order. Key groupings:

### property group

- `PropertiesElementInfo` (consolidated help text)
- `PropertiesBasic`, `PropertiesDefinition`, `PropertiesProcess` — Process Name / Version / Id are `PaneProperty type="text"`. Correlation Key is `OneLineFeelEditor` (`#process-correlation-key-property`). Do **not** key that editor (or its wrapper) on `element.correlationKey`: `onChange` fires on blur, a value-based key remounts CodeMirror during the canvas click that commits, and leftover FEEL autocomplete can steal the click so `selectBpmnElementByIdAndWaitForElement('StartEvent_1')` fails. User Task due date / HTTP auth header already omit that key. Re-selecting the process after visiting another element remounts the pane from the model.
- Task-specific: `PropertiesServiceTask`, `PropertiesReceiveTask`, `PropertiesSendTask`, `PropertiesScriptTask`, `PropertiesCallActivity`, `PropertiesManualTask`, `PropertiesBusinessRuleTask`, `PropertiesHttpTask`
- User task: `PropertiesUserTask`, `PropertiesUserTaskFormSummary`, `PropertiesUserTaskAssignees`
- All event panes (message, signal, error, escalation, conditional, timer, link)
- `PropertiesConditionalFlow`
- `PropertiesTextAnnotation` — native `PaneProperty type="textarea"` for `text` (not CodeMirror). Open-in-new-tab fragment is `BpmnTextFragmentRenderer` / `MultiLineCodeEditor`.
- `PropertiesComplexGatewayActivationCondition` — FEEL multi-line editor for the Complex Gateway join **activation condition** (visible only when the selected Complex Gateway is a join or mixed gateway, i.e. more than one incoming sequence flow)
- Loop/MI: `PropertiesLoop`, `PropertiesCompletionCondition`, `PropertiesInputCollection`, `PropertiesOutputCollection`, `PropertiesParallelMiSettings`, `PropertiesSequentialMiSettings`
- Data Object: `PropertiesDataObject`
- `PropertiesAdHocSubprocess` — ordering, cancel remaining instances, implementation, active elements, completion condition (visible only for `BpmnElementType.AdHocSubprocess`)

#### Suggestion-select remount keys (Call Activity / Business Rule Task)

`PropertyValueWithSuggestions` is **uncontrolled** (`defaultValue` once, not `value`). The search input starts empty so the menu is unfiltered; the selected option displays as `.react-select__single-value`. Do not seed `defaultInputValue` with the selected option and do not restore that option into the search input on blur/Escape — that filters the menu to the current value (Send Task then cannot pick a newly created name). Dependent fields remount **after** the parent ID commits; the control being edited must not include that ID in its own React `key`. The custom Input `onKeyDown` handles Escape (blur + clear search input) and **must** forward every other key to `inputProps.onKeyDown` so Enter selects `Use "…"`. `handleChange` with `action === 'clear'` (or a blank value) calls `onInputChange('')` and `onChange(null)` — `optionize` must not turn `''` into `{ value: '' }`, because react-select `hasValue()` is then true and the clear **X** stays on an empty field. Do **not** pass a controlled `value={selectedOption}`: that blocks the Creatable "Use …" option so typed text never becomes a create-option. Each CreatableSelect sets `instanceId` from `htmlId` so two suggestion controls on one pane do not share listbox IDs. `loadOptions` reads the suggestions Promise from a ref so a new Promise on parent render does not restart the async select.

| Pane | Parent ID | Remount target |
|------|-----------|----------------|
| `PropertiesCallActivity` | `processModelId` | `PaneBody key={element_process_id_${processModelId}}`. Process `PaneProperty` has no value-based key. Start Event is keyed by `startEventId`. |
| `PropertiesBusinessRuleTask` | `decisionRef` | Decision Ref has **no** value-based key. Decision Element ID, Result Variable, and Trace Unmatched Rules wrap in `Fragment key={element_decision_ref_${decisionRef}}`. `optionize('')` is `null` — an empty string is not a selected option (otherwise the X stays on a blank field). Clearing Decision Ref writes `newDecisionRef` and `newDecisionElementId` in one command. |
| `PropertiesEscalationBoundaryEvent` | — | Renderer has **no** value-based key. Name and code `PaneProperty`s have none either. `getKeyForPropertiesPane` is `type__id` only (not `name`). A wrapper `key={element_code_${code}_element_name_${name}}` remounted the radios and re-initialized `matchAllEscalations` when Clear wrote `name: ''`, hiding the fields mid-`clearSuggestionSelect`. Tests click the specific-escalation **label** after Escape closes the context pad. |
| Send / Receive / Message * / Signal * / Link * / Error End | — | The field being edited has **no** value-based key. `key={element_message_name_${message}}` (and the signal / link / error-code equivalents) remounted the control, seeded a filtered search box, and hid other options. |

`htmlId` is on the CreatableSelect. `JumpToSymbolInSolutionLink` (`[data-test--jump-to-symbol-in-solution]`) lives in the `PaneProperty` label, not inside that id.

### scripting group

- Data pipeline: `PropertiesInputMappings`, `PropertiesOutputMappings`, `PropertiesPayloadContract`, `PropertiesResultContract`. Mapping **source** is `OneLineFeelEditor`. Row React keys use a stable `rowId` stamped on the live `evil:InputMapping` / `evil:OutputMapping` moddle object (`BpmnDocumentElementAccess` WeakMap), not `${source}->${target}` (that remounts CodeMirror on blur). `htmlId`s still use the array index (`#data-pipeline-input-source-0`).
- `PropertiesCorrelationRetrievalExpression` — FEEL editor for **throw-side** message events (`MessageIntermediateThrowEvent`, `MessageEndEvent`, `SendTask`). Catch-side correlation uses the process-level `evil:correlationKey`, not this extension.
- `PropertiesDataOutputAssociationDataSource`
- `DefaultCustomStartToken`, `PropertiesExamplePayload`, `PropertiesExampleResult`
- `PropertiesCustomAttributes` — name/value rows for `evil:property`. Names in `getInternalCustomPropertyNames` (e.g. `studio.defaultCustomStartToken` on Start Events) are hidden unless **Show internal custom properties** is on. Row React keys use a stable `rowId` stamped on the live moddle object (`BpmnDocumentElementAccess` WeakMap), not `property.name` (names can be blank or duplicated) and not the `.map` index (`@eslint-react/no-array-index-key` is an error). The empty add-row uses `custom-property-add-row-${elementId}`. Input `htmlId`s still use the full array index including hidden rows. Integration-test fixtures keep only rows that tests assert, Custom Attributes indexes, Timer Start `enabled`, or merge-diff payload. Default Configured Start Payload tests use `untyped-task.bpmn`. ProcessEngine leftovers (`module`/`method`/`params`/`role`, Task-level `enabled`, `payload` on `##external`) and unnamed sample diagrams are not stored in fixtures.

#### Message Event Data Pipeline (D-MSG-1)

Per architectural decision D-MSG-1 / MSG-D1, message events use generic input/output mappings. There is no `evil:payload` or `evil:eventMapping`. Authoring pane visibility matches the live pipeline: Send/throw show Input Mappings; Receive/catch show Output Mappings. Embedded SubProcess mappings are authorable only on Ad-hoc shells.

| Element type | Input Mappings | Output Mappings | Payload Contract | Result Contract | Correlation Retrieval |
|--------------|:-:|:-:|:-:|:-:|:-:|
| MessageEndEvent | yes | — | yes | — | yes |
| MessageIntermediateThrowEvent | yes | — | yes | — | yes |
| SendTask | yes | — | yes | — | yes (authoring; Engine SendTask publishes via process-level `correlationKey`) |
| MessageIntermediateCatchEvent | — | yes | — | yes | — |
| MessageBoundaryEvent | — | yes | — | yes | — |
| ReceiveTask | — | yes | — | yes | — |
| MessageStartEvent | — | — | — | yes | — |

`MessageStartEvent` has **no** output mappings on the Engine model (`StartEventNode` exposes `eventDefinition`, `resultContract`, `isInterrupting` only). Catch-side nodes do not author `evil:correlationRetrievalExpression`.

Per D-MSG-3, contracts on message events are direction-aware: throw-side events (MessageEndEvent, MessageIntermediateThrowEvent, SendTask) show the **Payload Contract** pane, and catch-side events (MessageIntermediateCatchEvent, MessageBoundaryEvent, MessageStartEvent, ReceiveTask) show the **Result Contract** pane. This aligns with task contract semantics where `payloadContract` validates outgoing data and `resultContract` validates incoming data.

Signal events do not support contracts (the engine has no signal contract capability). Payload Contract and Input Mapping visibility were split into separate type lists (`DATA_PIPELINE_PAYLOAD_CONTRACT_TYPES` and `DATA_PIPELINE_INPUT_MAPPING_TYPES` in `PropertiesPaneFunctions.ts`) so that signal throw-side events show Input Mappings (which the engine supports) without showing the Payload Contract pane (which would be dead data).

### documentation group

- `PropertiesElementDocumentation`

---

## Form Builder

### Overview

The Form Builder provides a visual drag-and-drop editor for configuring User Task form fields and action buttons. It replaces the previous inline form field editors (the old `PropertiesUserTaskFormFields` and `PropertiesUserTaskFormDisplay` panes).

### Architecture

| Component | Location | Purpose |
|-----------|----------|---------|
| `FormRenderer` | `studio/src/modules/bpmn-core/form-renderer/` | Shared renderer used by both design-time preview and runtime debugger |
| `FormBuilder` | `studio/src/modules/bpmn-editor/form-builder/` | Design-time editor (fragment renderer) |
| `PropertiesUserTaskFormSummary` | `studio/src/modules/bpmn-editor/panes/properties/UserTask/` | Summary pane with field count + "Edit Form" button |

### Data Model

Form data is stored as two separate extension elements on User Tasks:

- `evil:FormFields` — JSON array of `FormFieldDefinition[]`
- `evil:FormActions` — JSON array of `FormAction[]`

Both are read/written via `BpmnDocumentElementAccess.getFormFieldDefinitions()` / `setFormFieldDefinitions()` / `getFormActions()` / `setFormActions()`.

### Field Types (v1)

| Type | SDK Enum | Description |
|------|----------|-------------|
| text | `FormFieldType.Text` | Single-line text input |
| number | `FormFieldType.Number` | Numeric input |
| date | `FormFieldType.Date` | Date picker |
| checkbox | `FormFieldType.Checkbox` | Checkbox |
| select | `FormFieldType.Select` | Dropdown select |
| radio | `FormFieldType.Radio` | Radio button group |
| textarea | `FormFieldType.Textarea` | Multi-line text |
| file | `FormFieldType.File` | File upload |
| boolean | `FormFieldType.Boolean` | Toggle switch |
| header | `FormFieldType.Header` | Section heading (non-input) |

### Form Actions

Actions define the buttons at the bottom of the form. Each action has:
- `id` — Unique identifier
- `label` — Button text
- `preset` — One of: `confirm`, `ok`, `yes`, `no`, `cancel`, `custom`
- `submitsForm` — Whether clicking the action triggers form validation and submission
- `isDefault` — Primary visual emphasis
- `isDanger` — Destructive visual emphasis

When no actions are configured, the `FormRenderer` shows a default "OK" button.

### Fragment Pattern

The Form Builder opens as a fragment editor tab (no own model). It parses a URI of the form `fragment+bpmn.form-builder:<parentUri>#!fragmentId=<elementId>` and accesses the parent BPMN document model to read/write form data.

Integration tests live in `studio/test/integration/bpmn-editor/form-builder.test.ts` and open `studio/test/fixtures/test-solution-bpmn/form-builder.bpmn` (`UserTask_1` with no form fields). The empty new-document template (`BpmnEmptyDocument.bpmn`) has no user task. `user-task.bpmn` already has `evil:formFields`, so the summary pane shows Edit Form instead of Create Form. Persist tests close only the focused Form Builder tab (`std.editor.closeFocusedDocument`), not `Test: Close all`, so the parent BPMN stays in memory with the written fields.

There is no `data-test--actions-editor-add-button` and no shared `data-test--form-builder-toolbox-item`. Field kits use `[data-test--form-builder-toolbox-field="<type>"]` (`text`, `number`, `date`, `checkbox`, `select`, `radio`, `textarea`, `file`, `boolean`, `header`). Action presets use `[data-test--form-builder-toolbox-action="<preset>"]` (`confirm`, `ok`, `yes`, `no`, `cancel`, `custom`). Added actions render `[data-test--actions-editor-item]` in `ActionsEditor`.

Command: `bpmn.formBuilder.open` — opens the form builder for the selected User Task element.

### Debugger Integration

The engine-debugger uses `DynamicUiComponentAdapter` (`studio/src/modules/engine-debugger/task-viewer/DynamicUiComponentAdapter.tsx`) to render User Task forms at runtime. It:

1. Receives `UserTaskInstance` with `userTaskConfig.formFields` and `userTaskConfig.formActions` from the engine
2. Maps engine field types to SDK `FormFieldType` enum values (e.g., engine `string` → `FormFieldType.Text`, engine `enum` → `FormFieldType.Select`)
3. Maps engine actions to SDK `FormAction[]` (preserving `submitsForm`, `isDefault`, `isDanger` flags)
4. Renders the shared `FormRenderer` component
5. On submit: calls `userTasks.finishUserTask(id, data, identity)` with collected form data
6. On cancel: calls `userTasks.finishUserTask(id, { _action, _cancelled: true }, identity)`

### Data Flow

**Write path** (Form Builder → BPMN model):
```
User edits field → setFields(newFields)
  → model.elements.setFormFieldDefinitions(fragmentId, newFields)
    → setEvilBodyExtension(element, 'evil:FormFields', JSON.stringify(fields))
      → commandStack.execute('element.updateProperties', ...)
```

**Read path** (BPMN model → Form Builder UI):
```
Model loads → onceInteractive() → readFromModel()
  → getFormFieldDefinitions(fragmentId)
    → getEvilBodyValue(element, 'evil:FormFields')
      → JSON.parse(body) → FormFieldDefinition[]

Model changes (undo/redo/external) → EVENT_DATA_UPDATED
  → readFromModel() → setFieldsInternal(currentFields)
```

**Debugger path** (Engine response → Form UI → Engine API):
```
Engine GET /user-tasks/:id → UserTaskInstance
  → mapEngineFieldToDefinition(field) → FormFieldDefinition[]
  → mapEngineActionsToFormActions(actions) → FormAction[]
  → <FormRenderer fields actions onSubmit onCancel />
  → User clicks action → collectFormData() → POST finishUserTask
```

---

## Shared Editor Components for Property Panes

### KeyValueJsonEditor

**Path:** `studio/src/components/key-value-builder/`

A dual-mode editor component for panes that store JSON object data. Provides a structured key-value builder UI for flat objects and a raw `MultiLineCodeEditor` fallback for complex/nested structures. The user can toggle between modes at any time.

| Component | Purpose |
|-----------|---------|
| `KeyValueBuilder` | Standalone row-based key-value entry builder (add/remove/edit rows) |
| `KeyValueJsonEditor` | Dual-mode wrapper: builder view for flat objects, raw JSON view for complex data |
| `jsonToEntries()` | Converts a JSON object string to `{ key, value }[]` pairs |
| `entriesToJson()` | Converts pairs back to a pretty-printed JSON string with smart-typed values |
| `smartParseValue()` | Types string values: `"true"`/`"false"` → boolean, `"null"` → null, numeric strings → number |

**Builder compatibility detection:** When the stored JSON contains nested objects or arrays, the component automatically starts in raw JSON mode because those structures cannot be represented as flat key-value pairs. Empty or flat-object values start in builder mode.

**Test selectors:** `htmlAttributes` (for example `data-test--default-custom-start-token-input`) land on the outer wrapper, which also carries `data-test--kv-json-editor-mode` (`builder` or `json`). Builder rows use `[data-test--kv-builder-add-button]`, `[data-test--kv-builder-key-input="<index>"]`, and `[data-test--kv-builder-value-input="<index>"]`. The mode toggle is `[data-test--kv-json-editor-toggle]`. Empty/flat payloads have no `.cm-content` until the user switches to JSON. The open-in-new-tab fragment renderer is still `MultiLineCodeEditor`.

**Used by:**

| Pane | Property stored | Element types |
|------|----------------|---------------|
| Default Configured Start Payload | `studio.defaultCustomStartToken` | All StartEvent variants |
| Example Payload | `studio.examplePayload` | MessageIntermediateCatchEvent, MessageBoundaryEvent, ReceiveTask, SendTask, MessageIntermediateThrowEvent, MessageEndEvent |
| Example Result | `studio.exampleResult` | BusinessRuleTask, CallActivity, ServiceTask, HttpServiceTask |

### Contract Panes (JSON Schema editors)

The Payload Contract, Result Contract, and Data Object Value Contract panes use `MultiLineCodeEditor` with `language="json"` for syntax-highlighted JSON Schema editing. These replaced plain `PaneProperty type="textarea"` fields that had no highlighting or bracket matching.

| Pane | Property | MultiLineCodeEditor htmlId |
|------|----------|---------------------------|
| Payload Contract | `dataPipeline.payloadContract` | `data-pipeline-payload-contract` |
| Result Contract | `dataPipeline.resultContract` | `data-pipeline-result-contract` |
| Data Object Value Contract | `element.valueContract` | `data-object-value-contract` |

---

## SDK Types

### BpmnLoopConfig

Discriminated union for loop characteristics:

```typescript
export type BpmnLoopConfig = BpmnStandardLoopConfig | BpmnMultiInstanceLoopConfig;

export type BpmnStandardLoopConfig = {
  readonly kind: 'standard';
  readonly loopCondition?: string;
  readonly loopMaximum?: string;
  readonly testBefore?: boolean;
  readonly loopInterval?: string;
};

export type BpmnMultiInstanceLoopConfig = {
  readonly kind: 'multiInstance';
  readonly isSequential: boolean;
  readonly completionCondition?: string;
  readonly inputDataItem?: string;
  readonly outputDataItem?: string;
  readonly inputCollection?: string;
  readonly outputCollection?: string;
  readonly elementVariable?: string;
  readonly outputElementVariable?: string;
  readonly loopBreakCondition?: string;
  readonly maxIterations?: string;
  readonly loopInterval?: string;
};
```

Available on `BpmnElementCommonProperties.loopConfig`.

---

## Moddle descriptor conformance

`studio/src/modules/bpmn-core/bpmn-js/moddle/evil-platform.json` is the Studio-owned authoring contract. It is not generated from the Engine.

`verifyModdleConformance` (`studio/src/modules/bpmn-core/moddle/verifyModdleConformance.ts`) compares it to `extensionManifest` from `@elraptorus/daemonengine_sdk`:

| Direction | Rule |
|-----------|------|
| manifest → descriptor | every Engine `evil:*` element has a matching moddle type and compatible value type |
| descriptor → manifest | every non-abstract, non-BPMN-overlay, non-`extensible` moddle type appears in the manifest |
| `allowedIn` ⊆ `applicableTo` | the Studio may refuse to author an extension the Engine would read; it must not author one the Engine ignores |

The check runs as a unit test (`studio/test/unit/bpmn-core/moddleManifestConformance.test.ts`). A missing `extensionManifest` is a failure.

Event-definition carriers (`bpmn:ErrorEventDefinition`, `bpmn:MessageEventDefinition`) map to the parent event positions listed in the Engine manifest (`EndEvent`, `BoundaryEvent`, …).

---

## File Path Reference

| Component | Path |
|-----------|------|
| initializeBpmnPanes | `studio/src/modules/bpmn-editor/initializers/initializeBpmnPanes.ts` |
| BpmnDocumentElementAccess | `studio/src/modules/bpmn-editor/BpmnDocumentElementAccess.ts` |
| PropertiesElementInfo | `studio/src/modules/bpmn-editor/panes/properties/PropertiesElementInfo.tsx` |
| PropertiesElementDocumentation | `studio/src/modules/bpmn-editor/panes/properties/PropertiesElementDocumentation.tsx` |
| PropertiesInputMappings | `studio/src/modules/bpmn-editor/panes/properties/DataPipeline/PropertiesInputMappings.tsx` |
| PropertiesOutputMappings | `studio/src/modules/bpmn-editor/panes/properties/DataPipeline/PropertiesOutputMappings.tsx` |
| PropertiesPayloadContract | `studio/src/modules/bpmn-editor/panes/properties/DataPipeline/PropertiesPayloadContract.tsx` |
| PropertiesResultContract | `studio/src/modules/bpmn-editor/panes/properties/DataPipeline/PropertiesResultContract.tsx` |
| PropertiesUserTaskAssignees | `studio/src/modules/bpmn-editor/panes/properties/UserTask/PropertiesUserTaskAssignees.tsx` |
| PropertiesLoop | `studio/src/modules/bpmn-editor/panes/properties/Loop/PropertiesLoop.tsx` |
| PropertiesCompletionCondition | `studio/src/modules/bpmn-editor/panes/properties/MultiInstances/PropertiesCompletionCondition.tsx` |
| PropertiesInputCollection | `studio/src/modules/bpmn-editor/panes/properties/MultiInstances/PropertiesInputCollection.tsx` |
| PropertiesOutputCollection | `studio/src/modules/bpmn-editor/panes/properties/MultiInstances/PropertiesOutputCollection.tsx` |
| CmdHelper | `studio/src/modules/bpmn-core/bpmn-js/CommandHandler/Helper/CommmandHelper.ts` |
| UpdateLoopCharacteristicsHandler | `studio/src/modules/bpmn-core/bpmn-js/CommandHandler/UpdateLoopCharacteristicsHandler.ts` |
| UpdateUserTaskResourcesHandler | `studio/src/modules/bpmn-core/bpmn-js/CommandHandler/UpdateUserTaskResourcesHandler.ts` |
| UpdateServiceTaskHandler | `studio/src/modules/bpmn-core/bpmn-js/CommandHandler/UpdateServiceTaskHandler.ts` |
| BpmnServiceTaskImplementation | `studio/src/modules/bpmn-editor/BpmnElementTypes.ts` |
| BpmnLoopConfig types | `studio/src/modules/bpmn-editor/BpmnElementTypes.ts` |
| FormFieldDefinition / FormAction types | `studio/src/modules/bpmn-editor/BpmnElementTypes.ts` |
| FormRenderer (shared) | `studio/src/modules/bpmn-core/form-renderer/FormRenderer.tsx` |
| FormBuilderRenderer | `studio/src/modules/bpmn-editor/form-builder/FormBuilderRenderer.tsx` |
| PropertiesUserTaskFormSummary | `studio/src/modules/bpmn-editor/panes/properties/UserTask/PropertiesUserTaskFormSummary.tsx` |
| DynamicUiComponentAdapter | `studio/src/modules/engine-debugger/task-viewer/DynamicUiComponentAdapter.tsx` |
| PropertiesCorrelationRetrievalExpression | `studio/src/modules/bpmn-editor/panes/properties/MessageCorrelation/PropertiesCorrelationRetrievalExpression.tsx` |
| UpdateCorrelationRetrievalExpressionHandler | `studio/src/modules/bpmn-core/bpmn-js/CommandHandler/UpdateCorrelationRetrievalExpressionHandler.ts` |
| PropertiesPaneFunctions | `studio/src/modules/bpmn-editor/panes/PropertiesPaneFunctions.ts` |
| evil-platform.json | `studio/src/modules/bpmn-core/bpmn-js/moddle/evil-platform.json` |
| verifyModdleConformance | `studio/src/modules/bpmn-core/moddle/verifyModdleConformance.ts` |
| BpmnElementCustomPropertiesFunctions | `studio/src/modules/bpmn-editor/panes/BpmnElementCustomPropertiesFunctions.ts` |
| KeyValueBuilder | `studio/src/components/key-value-builder/KeyValueBuilder.tsx` |
| KeyValueJsonEditor | `studio/src/components/key-value-builder/KeyValueJsonEditor.tsx` |
| PropertiesDataObject | `studio/src/modules/bpmn-editor/panes/properties/DataObject/PropertiesDataObject.tsx` |
| DefaultCustomStartToken | `studio/src/modules/bpmn-editor/panes/properties/DefaultCustomStartToken/PropertiesDefaultCustomStartToken.tsx` |
| PropertiesExamplePayload | `studio/src/modules/bpmn-editor/panes/properties/ExamplePayload/PropertiesExamplePayload.tsx` |
| PropertiesExampleResult | `studio/src/modules/bpmn-editor/panes/properties/ExampleResult/PropertiesExampleResult.tsx` |
| PropertiesCallActivity | `studio/src/modules/bpmn-editor/panes/properties/CallActivity/PropertiesCallActivity.tsx` |
| PropertiesProcess | `studio/src/modules/bpmn-editor/panes/properties/PropertiesProcess.tsx` |
| PropertiesBusinessRuleTask | `studio/src/modules/bpmn-editor/panes/properties/BusinessRuleTask/PropertiesBusinessRuleTask.tsx` |
| JumpToSymbolInSolutionLink | `studio/src/modules/bpmn-editor/panes/components/JumpToSymbolInSolutionLink.tsx` |
| PropertiesTextAnnotation | `studio/src/modules/bpmn-editor/panes/properties/TextAnnotation/PropertiesTextAnnotation.tsx` |
| BpmnTextFragmentRenderer | `studio/src/modules/bpmn-editor/open-in-new-tab-renderer/BpmnTextFragmentRenderer.tsx` |
| PropertiesComplexGatewayActivationCondition | `studio/src/modules/bpmn-editor/panes/properties/ComplexGateway/PropertiesComplexGatewayActivationCondition.tsx` |
| Complex Gateway help text | `studio/src/modules/bpmn-editor/panes/properties/ComplexGateway/PropertiesComplexGateway.md` |
