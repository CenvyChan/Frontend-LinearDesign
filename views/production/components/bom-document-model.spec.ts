import { describe, expect, it } from 'vitest';

import type { BomTreeNode } from '#/api/bom';

import { buildBomDocumentMaterialNodes, buildBomDocumentTreeRows, flattenBomDocumentTree } from './bom-document-model';

function node(partial: Partial<BomTreeNode>): BomTreeNode {
  return {
    bomLevel: 0,
    bomLevelPath: '',
    bomVersion: '',
    childBomId: 0,
    childMaterialName: '',
    childMaterialNumber: '',
    denominator: 1,
    fixedScrap: 0,
    id: partial.id || '',
    inputMaterialCode: '',
    levelCode: '',
    materialModel: '',
    numerator: 1,
    parentMaterialName: '',
    parentMaterialNumber: '',
    quantity: 1,
    replaceGroup: 0,
    seq: 0,
    topBomId: 0,
    useOrgId: 0,
    variableScrap: 0,
    ...partial,
  };
}

describe('bom document model', () => {
  it('uses only the selected root and its descendants', () => {
    const root = node({
      id: 'root',
      inputMaterialCode: 'ROOT',
      isRoot: true,
      children: [
        node({ id: 'child-1', bomLevel: 1, childMaterialNumber: 'A', parentMaterialNumber: 'ROOT' }),
        node({ id: 'child-2', bomLevel: 2, childMaterialNumber: 'A', parentMaterialNumber: 'A' }),
      ],
    });

    expect(flattenBomDocumentTree(root).map((item) => item.id)).toEqual(['root', 'child-1', 'child-2']);
  });

  it('keeps repeated material codes when they are different tree nodes', () => {
    const root = node({
      id: 'root',
      inputMaterialCode: 'ROOT',
      parentMaterialName: 'Root material',
      bomVersion: 'V1',
      isRoot: true,
      children: [
        node({ id: 'child-1', bomLevel: 1, childMaterialNumber: 'A', parentMaterialNumber: 'ROOT' }),
        node({ id: 'child-2', bomLevel: 2, childMaterialNumber: 'A', parentMaterialNumber: 'A' }),
      ],
    });

    expect(buildBomDocumentMaterialNodes(root).map((item) => item.materialCode)).toEqual(['ROOT', 'A', 'A']);
  });

  it('uses the root tree as table rows so repeated descendants stay under their parents', () => {
    const root = node({
      id: 'root',
      inputMaterialCode: 'ROOT',
      isRoot: true,
      children: [
        node({
          id: 'assembly-1',
          bomLevel: 1,
          childMaterialNumber: 'ASM-1',
          children: [node({ id: 'raw-1', bomLevel: 2, childMaterialNumber: 'RAW', parentMaterialNumber: 'ASM-1' })],
        }),
        node({
          id: 'assembly-2',
          bomLevel: 1,
          childMaterialNumber: 'ASM-2',
          children: [node({ id: 'raw-2', bomLevel: 2, childMaterialNumber: 'RAW', parentMaterialNumber: 'ASM-2' })],
        }),
      ],
    });

    const rows = buildBomDocumentTreeRows(root);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.children?.map((item) => item.id)).toEqual(['assembly-1', 'assembly-2']);
    expect(rows[0]?.children?.[0]?.children?.[0]?.id).toBe('raw-1');
    expect(rows[0]?.children?.[1]?.children?.[0]?.id).toBe('raw-2');
  });
});
