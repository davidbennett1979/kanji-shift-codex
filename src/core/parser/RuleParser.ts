import type { EntityDef, EntityState, ParsedRule } from '../model/Types';
import { isAndOperator, isTopicConnector } from './GrammarRegistry';

type Axis = 'horizontal' | 'vertical';

type CellTokens = {
  nouns: Array<{ entity: EntityState; def: EntityDef }>;
  properties: Array<{ entity: EntityState; def: EntityDef }>;
  hasTopic: boolean;
  hasAnd: boolean;
};

type BoardTokens = {
  width: number;
  height: number;
  cells: Map<string, CellTokens>;
};

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

function isInBounds(width: number, height: number, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < width && y < height;
}

function emptyCellTokens(): CellTokens {
  return {
    nouns: [],
    properties: [],
    hasTopic: false,
    hasAnd: false,
  };
}

function tokenizeBoard(
  width: number,
  height: number,
  entities: Iterable<EntityState>,
  getDef: (defId: string) => EntityDef,
): BoardTokens {
  const cells = new Map<string, CellTokens>();

  const getOrCreate = (x: number, y: number): CellTokens => {
    const key = cellKey(x, y);
    const existing = cells.get(key);
    if (existing) return existing;
    const created = emptyCellTokens();
    cells.set(key, created);
    return created;
  };

  for (const entity of entities) {
    if (!isInBounds(width, height, entity.x, entity.y)) {
      continue;
    }
    const def = getDef(entity.defId);
    const bucket = getOrCreate(entity.x, entity.y);

    if (def.nounKey && (def.kind === 'object' || (def.kind === 'text' && def.textRole === 'noun'))) {
      bucket.nouns.push({ entity, def });
    }
    if (def.kind === 'text' && def.textRole === 'property' && def.propertyKey) {
      bucket.properties.push({ entity, def });
    }
    if (isTopicConnector(def)) {
      bucket.hasTopic = true;
    }
    if (isAndOperator(def)) {
      bucket.hasAnd = true;
    }
  }

  return { width, height, cells };
}

function getCell(board: BoardTokens, x: number, y: number): CellTokens | undefined {
  if (!isInBounds(board.width, board.height, x, y)) {
    return undefined;
  }
  return board.cells.get(cellKey(x, y));
}

function parseAxisFrom(
  board: BoardTokens,
  x: number,
  y: number,
  dx: number,
  dy: number,
  axis: Axis,
  seen: Set<string>,
  out: ParsedRule[],
): void {
  const start = getCell(board, x, y);
  if (!start || start.nouns.length === 0) {
    return;
  }
  const topicCell = getCell(board, x + dx, y + dy);
  if (!topicCell?.hasTopic) {
    return;
  }

  for (const nounToken of start.nouns) {
    const nounKey = nounToken.def.nounKey;
    if (!nounKey) {
      continue;
    }

    let offset = 2;
    while (true) {
      const tx = x + dx * offset;
      const ty = y + dy * offset;
      const termCell = getCell(board, tx, ty);
      if (!termCell) {
        break;
      }

      let emittedAnyTerm = false;

      for (const propToken of termCell.properties) {
        const property = propToken.def.propertyKey;
        if (!property) {
          continue;
        }
        emittedAnyTerm = true;
        const sig = `p:${nounKey}:${property}`;
        if (seen.has(sig)) {
          continue;
        }
        seen.add(sig);
        out.push({
          kind: 'property',
          noun: nounKey,
          property,
          axis,
          cells: [[x, y], [x + dx, y + dy], [tx, ty]],
        });
      }

      for (const targetToken of termCell.nouns) {
        const targetNoun = targetToken.def.nounKey;
        if (!targetNoun) {
          continue;
        }
        emittedAnyTerm = true;
        const sig = `n:${nounKey}:${targetNoun}`;
        if (seen.has(sig)) {
          continue;
        }
        seen.add(sig);
        out.push({
          kind: 'transform',
          noun: nounKey,
          targetNoun,
          axis,
          cells: [[x, y], [x + dx, y + dy], [tx, ty]],
        });
      }

      if (!emittedAnyTerm) {
        break;
      }

      const andCell = getCell(board, x + dx * (offset + 1), y + dy * (offset + 1));
      if (!andCell?.hasAnd) {
        break;
      }
      offset += 2;
    }
  }
}

export function parseRulesFromBoard(
  width: number,
  height: number,
  entities: Iterable<EntityState>,
  getDef: (defId: string) => EntityDef,
): ParsedRule[] {
  const board = tokenizeBoard(width, height, entities, getDef);
  const rules: ParsedRule[] = [];
  const seen = new Set<string>();

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x + 2 < width) {
        parseAxisFrom(board, x, y, 1, 0, 'horizontal', seen, rules);
      }
      if (y + 2 < height) {
        parseAxisFrom(board, x, y, 0, 1, 'vertical', seen, rules);
      }
    }
  }

  return rules;
}
