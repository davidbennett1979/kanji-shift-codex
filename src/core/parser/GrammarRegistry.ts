import type { EntityDef } from '../model/Types';

export const GRAMMAR_CONNECTORS = {
  TOPIC_IS: {
    key: 'TOPIC' as const,
    glyph: 'は',
    meaning: 'is',
  },
};

export const GRAMMAR_OPERATORS = {
  AND: {
    key: 'AND' as const,
    glyph: 'と',
    meaning: 'and',
  },
};

export function isTopicConnector(def: EntityDef): boolean {
  return def.kind === 'text' && def.textRole === 'connector' && def.connectorKey === GRAMMAR_CONNECTORS.TOPIC_IS.key;
}

export function isAndOperator(def: EntityDef): boolean {
  return def.kind === 'text' && def.textRole === 'operator' && def.operatorKey === GRAMMAR_OPERATORS.AND.key;
}

