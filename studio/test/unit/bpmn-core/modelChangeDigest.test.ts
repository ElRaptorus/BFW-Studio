import { describe, expect, it } from 'vitest';

import { buildModelChangeDigestForXmlPair } from '../../../src/modules/bpmn-core/diff/modelChangeDigest';

type Summary = Awaited<ReturnType<Parameters<typeof buildModelChangeDigestForXmlPair>[3]>>;

const emptySummary: Summary = { added: [], removed: [], modified: [], layoutChanged: [] };

function entries(...displayNames: string[]): { displayName: string }[] {
  return displayNames.map((displayName) => ({ displayName }));
}

function mustNotDiff(): Promise<Summary> {
  throw new Error('must not diff');
}

async function addedModelName(xml: string, rootElementName: 'process' | 'definitions'): Promise<string | null> {
  return (await buildModelChangeDigestForXmlPair(null, xml, rootElementName, mustNotDiff)).modelName;
}

describe('buildModelChangeDigestForXmlPair', () => {
  const processXml = (name: string): string => `<bpmn:process id="p" name="${name}">`;

  it('copies display names and counts layout changes; names the model from the after side', async () => {
    const digest = await buildModelChangeDigestForXmlPair(
      processXml('Old name'),
      processXml('Order process'),
      'process',
      async () => ({
        added: entries('Check stock'),
        removed: entries('Old step', 'Older step'),
        modified: entries('Approve'),
        layoutChanged: [{}, {}, {}],
      }),
    );

    expect(digest).toEqual({
      fileChange: 'modified',
      modelName: 'Order process',
      addedElementNames: ['Check stock'],
      removedElementNames: ['Old step', 'Older step'],
      modifiedElementNames: ['Approve'],
      layoutChangedCount: 3,
      fileDetailsChanged: false,
    });
  });

  it('passes both sides to the diff', async () => {
    const digest = await buildModelChangeDigestForXmlPair('before', 'after', 'process', async (before, after) => ({
      ...emptySummary,
      added: entries(`${before}->${after}`),
    }));

    expect(digest.addedElementNames).toEqual(['before->after']);
  });

  it('flags BPMN definitions metadata and linter score changes as file details', async () => {
    const withMetadata = await buildModelChangeDigestForXmlPair('a', 'b', 'process', async () => ({
      ...emptySummary,
      definitionsMetadata: [{}],
    }));
    const withLinterScore = await buildModelChangeDigestForXmlPair('a', 'b', 'process', async () => ({
      ...emptySummary,
      linterScoreChanges: [{}],
    }));

    expect(withMetadata.fileDetailsChanged).toBe(true);
    expect(withLinterScore.fileDetailsChanged).toBe(true);
  });

  it('treats a missing before side as an added model without diffing', async () => {
    const digest = await buildModelChangeDigestForXmlPair(null, processXml('Order'), 'process', mustNotDiff);

    expect(digest).toEqual({
      fileChange: 'added',
      modelName: 'Order',
      addedElementNames: [],
      removedElementNames: [],
      modifiedElementNames: [],
      layoutChangedCount: 0,
      fileDetailsChanged: false,
    });
  });

  it('treats a missing after side as a deleted model and names it from the before side', async () => {
    const digest = await buildModelChangeDigestForXmlPair(processXml('Order'), null, 'process', mustNotDiff);

    expect(digest).toMatchObject({ fileChange: 'deleted', modelName: 'Order', layoutChangedCount: 0 });
  });

  it('rejects when neither side exists', async () => {
    await expect(buildModelChangeDigestForXmlPair(null, null, 'process', mustNotDiff)).rejects.toThrow(
      /neither a before nor an after/,
    );
  });

  it('passes through errors from the diff', async () => {
    await expect(
      buildModelChangeDigestForXmlPair('a', 'b', 'process', async () => {
        throw new Error('invalid XML');
      }),
    ).rejects.toThrow('invalid XML');
  });
});

describe('buildModelChangeDigestForXmlPair: BPMN process name', () => {
  it('reads the name of a prefixed process', async () => {
    expect(await addedModelName('<bpmn:process id="p" name="Order" isExecutable="true">', 'process')).toBe('Order');
  });

  it('reads the name of a process in the default namespace', async () => {
    expect(await addedModelName('<definitions><process id="p" name="Order"></process></definitions>', 'process')).toBe(
      'Order',
    );
  });

  it('decodes XML entities', async () => {
    expect(await addedModelName('<bpmn:process id="p" name="Pick &amp; Pack &quot;fast&quot;">', 'process')).toBe(
      'Pick & Pack "fast"',
    );
  });

  it('ignores participants and attributes that merely end in "name"', async () => {
    expect(
      await addedModelName(
        '<bpmn:participant id="x" name="Pool" processRef="p" /><bpmn:process id="p" processType="None">',
        'process',
      ),
    ).toBeNull();
  });

  it('returns null for a blank name or no process', async () => {
    expect(await addedModelName('<bpmn:process id="p" name=" ">', 'process')).toBeNull();
    expect(await addedModelName('<bpmn:definitions />', 'process')).toBeNull();
  });
});

describe('buildModelChangeDigestForXmlPair: DMN definitions name', () => {
  it('reads the name of an unprefixed definitions root', async () => {
    expect(
      await addedModelName(
        '<?xml version="1.0"?><definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="d" name="Discount rules" namespace="x"><decision id="a" name="Other" /></definitions>',
        'definitions',
      ),
    ).toBe('Discount rules');
  });

  it('reads the name of a prefixed definitions root', async () => {
    expect(await addedModelName('<dmn:definitions id="d" name="Risk"></dmn:definitions>', 'definitions')).toBe('Risk');
  });

  it('does not take the name of a child element', async () => {
    expect(
      await addedModelName(
        '<definitions id="d" namespace="x"><decision id="a" name="Inner" /></definitions>',
        'definitions',
      ),
    ).toBeNull();
  });

  it('is not fooled by attributes that merely end in "name"', async () => {
    expect(
      await addedModelName('<definitions id="d" typeLanguageName="x" namespace="y"></definitions>', 'definitions'),
    ).toBeNull();
  });

  it('returns null for a blank name or a document without a root', async () => {
    expect(await addedModelName('<definitions id="d" name="  "></definitions>', 'definitions')).toBeNull();
    expect(await addedModelName('not xml', 'definitions')).toBeNull();
  });

  it('decodes numeric XML entities in the name', async () => {
    expect(
      await addedModelName(
        '<definitions id="d" name="Risk &amp; Pricing &#x2013; v2 &#8212; final"></definitions>',
        'definitions',
      ),
    ).toBe('Risk & Pricing \u2013 v2 \u2014 final');
  });
});
