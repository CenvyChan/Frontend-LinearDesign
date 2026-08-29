import type { BomTreeNode } from '#/api/bom';

export interface BomDocumentMaterialNode {
  materialCode: string;
  materialName?: string;
  bomVersion?: string;
  bomLevel?: number;
  parentMaterialCode?: string;
  parentMaterialName?: string;
}

export function bomDocumentMaterialCode(row: BomTreeNode) {
  return row.isRoot ? (row.inputMaterialCode || row.parentMaterialNumber || '') : (row.childMaterialNumber || '');
}

export function bomDocumentMaterialName(row: BomTreeNode) {
  return row.isRoot ? (row.parentMaterialName || row.inputMaterialCode || '') : (row.childMaterialName || '');
}

export function flattenBomDocumentTree(root: BomTreeNode) {
  const list: BomTreeNode[] = [];
  const walk = (item: BomTreeNode) => {
    list.push(item);
    item.children?.forEach(walk);
  };
  walk(root);
  return list;
}

export function buildBomDocumentTreeRows(root: BomTreeNode) {
  return [root].filter((row) => Boolean(bomDocumentMaterialCode(row)));
}

export function buildBomDocumentMaterialNodes(root: BomTreeNode): BomDocumentMaterialNode[] {
  return flattenBomDocumentTree(root)
    .map((row) => ({
      materialCode: bomDocumentMaterialCode(row),
      materialName: bomDocumentMaterialName(row),
      bomVersion: row.bomVersion,
      bomLevel: row.isRoot ? 0 : row.bomLevel,
      parentMaterialCode: row.isRoot ? '' : row.parentMaterialNumber,
      parentMaterialName: row.isRoot ? '' : row.parentMaterialName,
    }))
    .filter((row) => Boolean(row.materialCode));
}
