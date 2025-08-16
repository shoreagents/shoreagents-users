-- Task Custom Fields Schema

CREATE TABLE IF NOT EXISTS task_custom_fields (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '' NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NULL,
  updated_at timestamptz DEFAULT now() NULL
);

-- Maintain updated_at
CREATE OR REPLACE FUNCTION update_task_custom_fields_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW() AT TIME ZONE 'Asia/Manila';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_task_custom_fields_updated_at ON task_custom_fields;
CREATE TRIGGER trg_update_task_custom_fields_updated_at
BEFORE UPDATE ON task_custom_fields
FOR EACH ROW EXECUTE FUNCTION update_task_custom_fields_updated_at();

CREATE INDEX IF NOT EXISTS idx_task_custom_fields_task_id ON task_custom_fields(task_id);
CREATE INDEX IF NOT EXISTS idx_task_custom_fields_position ON task_custom_fields(task_id, position);


