<script lang="ts">
  import { App, Page, Navbar } from 'konsta/svelte'
  import WorkoutSummary from './lib/WorkoutSummary.svelte'
  import type { Workout } from './lib/workout'

  const sampleWorkout: Workout = {
    id: 'sample',
    date: 'Today',
    exercises: [
      { name: 'Squat', sets: [{ reps: 5, weightKg: 100 }, { reps: 5, weightKg: 100 }] },
      { name: 'Bench Press', sets: [{ reps: 8, weightKg: 60 }] },
    ],
  }
</script>

<App theme="ios">
  <Page>
    <Navbar title="Plates" />
    <WorkoutSummary workout={sampleWorkout} />
  </Page>
</App>
