export type Artifact = {
  id: number;
  created_at: string;
  brain: string;
  cycle: number | null;
  artifact_type: string;
  title: string;
  body_markdown: string;
  monologue_public: string;
  channel: string;
  source_platform: string;
  source_id: string;
  source_parent_id: string;
  source_url: string;
  search_queries: string;
};

export type Seed = {
  id: number;
  text: string;
  created_at: string;
};

export type Controls = {
  temperature: number;
  vote_1: number;
  vote_2: number;
  vote_3: number;
  vote_label_1: string;
  vote_label_2: string;
  vote_label_3: string;
  trajectory_reason: string;
  updated_at: string;
};

export type State = {
  artifact: Artifact | null;
  controls: Controls;
  seeds: Seed[];
};
