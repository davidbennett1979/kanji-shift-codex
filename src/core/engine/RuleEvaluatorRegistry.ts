import type { NounKey, ParsedRule, PropertyKey } from '../model/Types';

export type RuleAccumulationContext = {
  activeProps: Map<NounKey, Set<PropertyKey>>;
  activeTransforms: Map<NounKey, NounKey>;
};

type RuleEvaluator<K extends ParsedRule['kind']> = (
  rule: Extract<ParsedRule, { kind: K }>,
  ctx: RuleAccumulationContext,
) => void;

const propertyEvaluator: RuleEvaluator<'property'> = (rule, ctx) => {
  let props = ctx.activeProps.get(rule.noun);
  if (!props) {
    props = new Set<PropertyKey>();
    ctx.activeProps.set(rule.noun, props);
  }
  props.add(rule.property);
};

const transformEvaluator: RuleEvaluator<'transform'> = (rule, ctx) => {
  if (!ctx.activeTransforms.has(rule.noun)) {
    ctx.activeTransforms.set(rule.noun, rule.targetNoun);
  }
};

const RULE_EVALUATORS = {
  property: propertyEvaluator,
  transform: transformEvaluator,
} satisfies { [K in ParsedRule['kind']]: RuleEvaluator<K> };

export function accumulateRule(rule: ParsedRule, ctx: RuleAccumulationContext): void {
  if (rule.kind === 'property') {
    RULE_EVALUATORS.property(rule, ctx);
    return;
  }
  RULE_EVALUATORS.transform(rule, ctx);
}

