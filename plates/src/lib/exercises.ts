import type { SupabaseClient } from '@supabase/supabase-js'
import type { EquipmentType, ExerciseDefinition } from './workout'

interface ExerciseDefinitionRow {
  id: string
  name: string
  equipment_type: EquipmentType
}

function fromRow(row: ExerciseDefinitionRow): ExerciseDefinition {
  return { id: row.id, name: row.name, equipmentType: row.equipment_type }
}

export async function listExerciseDefinitions(client: SupabaseClient): Promise<ExerciseDefinition[]> {
  const { data, error } = await client
    .from('exercise_definitions')
    .select('id, name, equipment_type')
    .order('name')
  if (error) throw error
  return ((data ?? []) as ExerciseDefinitionRow[]).map(fromRow)
}

export async function createExerciseDefinition(
  client: SupabaseClient,
  name: string,
  equipmentType: EquipmentType,
): Promise<ExerciseDefinition> {
  const { data, error } = await client
    .from('exercise_definitions')
    .insert({ name, equipment_type: equipmentType })
    .select('id, name, equipment_type')
    .single()
  if (error) throw error
  return fromRow(data as ExerciseDefinitionRow)
}
