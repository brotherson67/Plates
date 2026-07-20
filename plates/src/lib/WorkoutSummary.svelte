<script lang="ts">
  import { Block, BlockTitle, List, ListItem } from 'konsta/svelte'
  import {
    calculateExerciseVolume,
    calculateWorkoutVolume,
    formatVolume,
    type Workout,
    type WeightUnit,
  } from './workout'

  export let workout: Workout
  export let unit: WeightUnit = 'kg'
</script>

<BlockTitle>{workout.date}</BlockTitle>
<List strong inset>
  {#each workout.exercises as exercise (exercise.name)}
    <ListItem
      title={exercise.name}
      after={formatVolume(calculateExerciseVolume(exercise), unit)}
    />
  {/each}
</List>
<Block strong inset>
  <p data-testid="workout-total">
    Total volume: {formatVolume(calculateWorkoutVolume(workout), unit)}
  </p>
</Block>
