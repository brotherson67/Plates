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
    {#snippet after()}
      <span class="data-value">{formatVolume(calculateExerciseVolume(exercise), unit)}</span>
    {/snippet}
    <ListItem title={exercise.name} {after} />
  {/each}
</List>
<Block strong inset>
  <p data-testid="workout-total">
    Total volume: <span class="data-value">{formatVolume(calculateWorkoutVolume(workout), unit)}</span>
  </p>
</Block>
