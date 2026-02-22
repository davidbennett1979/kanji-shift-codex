export type Direction = 'up' | 'down' | 'left' | 'right';

export type NounKey =
  | 'human'
  | 'tree'
  | 'rock'
  | 'mountain'
  | 'fire'
  | 'water'
  | 'gate'
  | 'volcano'
  | 'hotspring'
  | 'charcoal';

export type PropertyKey = 'YOU' | 'PUSH' | 'STOP' | 'WIN' | 'FLOAT' | 'SINK' | 'HOT';

export type EntityCategory = 'object' | 'text-noun' | 'text-property' | 'text-connector';

export type TextRole = 'noun' | 'property' | 'connector';

export interface EntityDef {
  id: string;
  glyph: string;
  kind: 'object' | 'text';
  category: EntityCategory;
  textRole?: TextRole;
  nounKey?: NounKey;
  propertyKey?: PropertyKey;
  connectorKey?: 'TOPIC';
  defaultProps?: PropertyKey[];
  defaultPushable?: boolean;
  defaultStop?: boolean;
  tint: number;
  label: string;
}

export interface EntityState {
  id: string;
  defId: string;
  x: number;
  y: number;
}

export interface LevelEntityPlacement {
  defId: string;
  x: number;
  y: number;
}

export interface LevelData {
  id: string;
  name: string;
  width: number;
  height: number;
  hint?: string;
  entities: LevelEntityPlacement[];
}

export interface ParsedRule {
  noun: NounKey;
  property: PropertyKey;
  axis: 'horizontal' | 'vertical';
  cells: [number, number][];
}

export interface FusionRecipe {
  id: string;
  inputs: [NounKey, NounKey];
  outputDefId: string;
  ordered?: boolean;
}

export type SimulationEventType =
  | 'move'
  | 'blocked'
  | 'fusion'
  | 'rule-change'
  | 'win'
  | 'undo'
  | 'restart'
  | 'level-load';

export interface SimulationEvent {
  type: SimulationEventType;
  message: string;
}

export interface ActiveRuleView {
  noun: NounKey;
  property: PropertyKey;
}

export interface SimulationSnapshot {
  levelId: string;
  levelName: string;
  width: number;
  height: number;
  hint?: string;
  moveCount: number;
  won: boolean;
  entities: EntityState[];
  activeRules: ActiveRuleView[];
  lastEvents: SimulationEvent[];
}
