-- Task relationships (only 'related_to')

CREATE TABLE IF NOT EXISTS task_relations (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  related_task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'related_to' CHECK (type IN ('related_to')),
  created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Manila')
);

-- Prevent duplicate relations of the same type between the same pair
CREATE UNIQUE INDEX IF NOT EXISTS uniq_task_relation
  ON task_relations(task_id, related_task_id, type);

-- Optional helper index
CREATE INDEX IF NOT EXISTS idx_task_relations_task_id ON task_relations(task_id);
CREATE INDEX IF NOT EXISTS idx_task_relations_related_task_id ON task_relations(related_task_id);


