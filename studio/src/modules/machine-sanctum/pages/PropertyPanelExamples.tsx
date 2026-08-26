import { EditorContent } from '#components/editor/EditorContent';

import React, { Fragment } from 'react';

import { PropertyPanelExampleRenderer } from './PropertyPanelExampleRenderer';

const EXAMPLES = [
  {
    title: 'Property Panel: Other controls',
    jsx: `
    <div className="pane">
      <div className="pane-header">Engine Explorer</div>
      <div className="pane__content">
        <p>
          This is a <code>.pane-item</code>:
        </p>
        <div className="pane-item">
          <div className="pane-item__squared-rounded-icon pane-item__squared-rounded-icon--big">
            <div className="squared-rounded-icon squared-rounded-icon--bg-1">
              <span className="ph-duotone ph-horse"></span>
            </div>
          </div>
          <div className="pane-item__text">
            Bifrost Forge World
            <div className="pane-item__sublabel">http://localhost:56000</div>
          </div>
          <div className="pane-item__options">
            <span className="pane-item__options-icon">
              <span className="ph-duotone ph-circle"></span>
            </span>
            <span className="pane-item__options-icon">
              <span className="ph ph-dots-three-vertical"></span>
            </span>
          </div>
        </div>

        <div className="pane-item">
          <div className="pane-item__squared-rounded-icon pane-item__squared-rounded-icon--big">
            <div className="squared-rounded-icon squared-rounded-icon--bg-2">
              <span className="ph-duotone ph-paw-print"></span>
            </div>
          </div>
          <div className="pane-item__text">
            Bifrost Forge World (bloodforge)
            <div className="pane-item__sublabel">http://localhost:56100</div>
          </div>
          <div className="pane-item__options">
            <span className="pane-item__options-icon">
              <span className="ph ph-dots-three-vertical"></span>
            </span>
          </div>
        </div>

      </div>
    </div>
    `,
  },
  {
    title: 'Property Panel: Other controls',
    jsx: `
    <div className="pane">
      <div className="pane-header">Settings</div>
      <div className="pane__content">
      <form>
      <fieldset>
        <div class="form-group row">
          <label for="staticEmail" class="col-sm-2 col-form-label">Email</label>
          <div class="col-sm-10">
            <input type="text" readonly="" class="form-control-plaintext" id="staticEmail" value="email@example.com">
          </div>
        </div>
        <div class="form-group">
          <label for="exampleInputEmail1">Email address</label>
          <input type="email" class="form-control" id="exampleInputEmail1" aria-describedby="emailHelp" placeholder="Enter email">
          <small id="emailHelp" class="form-text text-muted">We'll never share your email with anyone else.</small>
        </div>
        <div class="form-group">
          <label for="exampleInputPassword1">Password</label>
          <input type="password" class="form-control" id="exampleInputPassword1" placeholder="Password">
        </div>
        <div class="form-group">
          <label for="exampleSelect1">Example select</label>
          <select class="form-control" id="exampleSelect1">
            <option>1</option>
            <option>2</option>
            <option>3</option>
            <option>4</option>
            <option>5</option>
          </select>
        </div>
        <div class="form-group">
          <label for="exampleSelect2">Example multiple select</label>
          <select multiple="" class="form-control" id="exampleSelect2">
            <option>1</option>
            <option>2</option>
            <option>3</option>
            <option>4</option>
            <option>5</option>
          </select>
        </div>
        <div class="form-group">
          <label for="exampleTextarea">Example textarea</label>
          <textarea class="form-control" id="exampleTextarea" rows="3"></textarea>
        </div>
        <div class="form-group">
          <label for="exampleInputFile">File input</label>
          <input type="file" class="form-control-file" id="exampleInputFile" aria-describedby="fileHelp">
          <small id="fileHelp" class="form-text text-muted">This is some placeholder block-level help text for the above input. It's a bit lighter and easily wraps to a new line.</small>
        </div>
        <fieldset class="form-group">
          <legend>Radio buttons</legend>
          <div class="form-check">
            <label class="form-check-label">
              <input type="radio" class="form-check-input" name="optionsRadios" id="optionsRadios1" value="option1" checked="">
              Option one is this and that—be sure to include why it's great
            </label>
          </div>
          <div class="form-check">
          <label class="form-check-label">
              <input type="radio" class="form-check-input" name="optionsRadios" id="optionsRadios2" value="option2">
              Option two can be something else and selecting it will deselect option one
            </label>
          </div>
          <div class="form-check disabled">
          <label class="form-check-label">
              <input type="radio" class="form-check-input" name="optionsRadios" id="optionsRadios3" value="option3" disabled="">
              Option three is disabled
            </label>
          </div>
        </fieldset>
        <fieldset class="form-group">
          <legend>Checkboxes</legend>
          <div class="form-check">
            <input class="form-check-input" type="checkbox" id="check1" value="" checked="">
            <label class="form-check-label" for="check1">
              Option one is this and that—be sure to include why it's great
            </label>
          </div>
          <div class="form-check disabled">
            <input class="form-check-input" type="checkbox" id="check2" value="" disabled="">
            <label class="form-check-label" for="check2">
              Option two is disabled
            </label>
          </div>
        </fieldset>
        <fieldset class="form-group">
          <legend>Sliders</legend>
          <label for="customRange1">Example range</label>
          <input type="range" class="custom-range" id="customRange1">
        </fieldset>
        <button type="submit" class="btn btn-primary">Submit</button>
      </fieldset>
    </form>
      </div>
    </div>
    `,
  },
  {
    title: 'Property Panel: Form Elements',
    jsx: `
<div className="pane">
  <div className="pane-header">Different input fields</div>
  <div className="pane__content">
    <div class="form-group">
      <fieldset disabled="">
        <label class="control-label" for="disabledInput">Disabled input</label>
        <input class="form-control" id="disabledInput" type="text" placeholder="Disabled input here..." disabled="">
      </fieldset>
    </div>

    <div class="form-group">
      <fieldset>
        <label class="control-label" for="readOnlyInput">Readonly input</label>
        <input class="form-control" id="readOnlyInput" type="text" placeholder="Readonly input here…" readonly="">
      </fieldset>
    </div>

    <div class="form-group has-success">
      <label class="form-control-label" for="inputSuccess1">Valid input</label>
      <input type="text" value="correct value" class="form-control is-valid" id="inputValid">
      <div class="valid-feedback">Success! You've done it.</div>
    </div>

    <div class="form-group has-danger">
      <label class="form-control-label" for="inputDanger1">Invalid input</label>
      <input type="text" value="wrong value" class="form-control is-invalid" id="inputInvalid">
      <div class="invalid-feedback">Sorry, that username's taken. Try another?</div>
    </div>

    <div class="form-group">
      <label class="col-form-label col-form-label-lg" for="inputLarge">Large input</label>
      <input class="form-control form-control-lg" type="text" placeholder=".form-control-lg" id="inputLarge">
    </div>

    <div class="form-group">
      <label class="col-form-label" for="inputDefault">Default input</label>
      <input type="text" class="form-control" placeholder="Default input" id="inputDefault">
    </div>

    <div class="form-group">
      <label class="col-form-label col-form-label-sm" for="inputSmall">Small input</label>
      <input class="form-control form-control-sm" type="text" placeholder=".form-control-sm" id="inputSmall">
    </div>

    <div class="form-group">
      <label class="control-label">Input addons</label>
      <div class="form-group">
        <div class="input-group mb-3">
          <div class="input-group-prepend">
            <span class="input-group-text">$</span>
          </div>
          <input type="text" class="form-control" aria-label="Amount (to the nearest dollar)">
          <div class="input-group-append">
            <span class="input-group-text">.00</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
    `,
  },
  {
    title: 'Property Panel: Other controls',
    jsx: `
    <div className="pane">
      <div className="pane-header">Settings</div>
      <div className="pane__content">
        <div className="form-group">
          <label>Theme:</label>
          <select className="form-control form-control-sm">
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
        <div className="form-group">
          <p>
            You can also <a href="#">edit the JSON directly.</a>
          </p>
        </div>
        <div className="form-group"></div>
      </div>
    </div>
    `,
  },
];

export default function PropertyPanelExamples(props: any): React.JSX.Element {
  return (
    <EditorContent>
      <div className="machine-sanctum-subpage">
        <h2>TODO: Implement design system</h2>

        {EXAMPLES.map((example, index) => (
          <Fragment key={`${example.title}:${example.jsx.trim().slice(0, 80)}`}>
            <PropertyPanelExampleRenderer
              bifrost={props.bifrost}
              editorDocument={props.editorDocument}
              title={example.title}
              data={example.jsx}
              viewMediatorId={`property-panel-example-${index}`}
            />
            <hr />
          </Fragment>
        ))}
      </div>
    </EditorContent>
  );
}
