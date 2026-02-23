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

export type PropertyKey = 'YOU' | 'PUSH' | 'PULL' | 'STOP' | 'WIN' | 'FLOAT' | 'SINK' | 'HOT' | 'MELT';

export type EntityCategory = 'object' | 'text-noun' | 'text-property' | 'text-connector' | 'text-operator';

export type TextRole = 'noun' | 'property' | 'connector' | 'operator';

export interface EntityDef {
  id: string;
  glyph: string;
  kind: 'object' | 'text';
  category: EntityCategory;
  textRole?: TextRole;
  nounKey?: NounKey;
  propertyKey?: PropertyKey;
  connectorKey?: 'TOPIC';
  operatorKey?: 'AND';
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

export interface ParsedPropertyRule {
  kind: 'property';
  noun: NounKey;
  property: PropertyKey;
  axis: 'horizontal' | 'vertical';
  cells: [number, number][];
}

export interface ParsedTransformRule {
  kind: 'transform';
  noun: NounKey;
  targetNoun: NounKey;
  axis: 'horizontal' | 'vertical';
  cells: [number, number][];
}

export type ParsedRule = ParsedPropertyRule | ParsedTransformRule;

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
  | 'transform'
  | 'role-shift'
  | 'rule-change'
  | 'win'
  | 'undo'
  | 'restart'
  | 'level-load';

export interface SimulationEvent {
  type: SimulationEventType;
  message: string;
  x?: number;
  y?: number;
  cells?: [number, number][];
}

export interface ActiveRuleView {
  kind: 'property' | 'transform';
  noun: NounKey;
  property?: PropertyKey;
  targetNoun?: NounKey;
  cells?: [number, number][];
  axis?: 'horizontal' | 'vertical';
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
  focusRoles: {
    playerEntityId?: string;
    winEntityId?: string;
  };
  lastEvents: SimulationEvent[];
}
