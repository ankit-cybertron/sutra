// AUTO-GENERATED — do not edit by hand.
// Source: apps/api/app/schemas/spec.py
// Generator: apps/api/scripts/gen_schema.py

export interface AcceptanceCriterion {
  id: string;
  given: string;
  when: string;
  then: string;
  story: string;
}

export interface Assumption {
  id: string;
  statement: string;
  risk: string;
  status?: string;
}

export interface CoreLoopStep {
  step: number;
  actor: string;
  action: string;
  outcome: string;
}

export interface DataModel {
  entities: Array<Entity>;
}

export interface Decision {
  topic: string;
  final: string;
  superseded?: Array<string>;
  evidence?: Array<Span>;
}

export interface EdgeCase {
  case: string;
  handling: string;
}

export interface Entity {
  name: string;
  fields: Array<FieldDef>;
  relations?: Array<string>;
}

export interface FieldDef {
  name: string;
  type: string;
  required?: boolean;
  notes?: string;
}

export interface Problem {
  statement: string;
  narrow_user: string;
  why_now?: string | null;
}

export interface Scope {
  must: Array<string>;
  should?: Array<string>;
  wont_now: Array<string>;
  cut_line: string;
}

export interface Screen {
  name: string;
  purpose: string;
  states: ScreenStates;
}

export interface ScreenStates {
  empty: string;
  loading: string;
  error: string;
  success: string;
}

export interface Span {
  start: number;
  end: number;
}

export interface UserStory {
  id: string;
  as_a: string;
  i_want: string;
  so_that: string;
  priority: string;
}

export interface Spec {
  schema_version?: string;
  title: string;
  tagline: string;
  problem: Problem;
  core_loop: Array<CoreLoopStep>;
  scope: Scope;
  user_stories: Array<UserStory>;
  data_model: DataModel;
  screens: Array<Screen>;
  edge_cases: Array<EdgeCase>;
  acceptance_criteria: Array<AcceptanceCriterion>;
  first_prompt: string;
  decisions: Array<Decision>;
  assumptions?: Array<Assumption>;
  open_questions?: Array<string>;
}
