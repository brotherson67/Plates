<script lang="ts">
  import { Block, BlockTitle, List, ListInput, Button } from 'konsta/svelte'
  import type { SupabaseClient } from '@supabase/supabase-js'
  import { signInWithPassword } from './auth'

  export let client: SupabaseClient

  let email = ''
  let password = ''
  let error: string | null = null
  let submitting = false

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault()
    error = null
    submitting = true
    try {
      await signInWithPassword(client, email, password)
    } catch (err) {
      error = err instanceof Error ? err.message : 'Sign in failed.'
    } finally {
      submitting = false
    }
  }
</script>

<BlockTitle>Sign in</BlockTitle>
<form on:submit={handleSubmit} data-testid="login-form">
  <List strong inset>
    <ListInput
      label="Email"
      type="email"
      placeholder="you@example.com"
      bind:value={email}
      required
    />
    <ListInput
      label="Password"
      type="password"
      placeholder="Password"
      bind:value={password}
      required
    />
  </List>
  {#if error}
    <Block strong inset>
      <p data-testid="login-error">{error}</p>
    </Block>
  {/if}
  <Block strong inset>
    <Button type="submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</Button>
  </Block>
</form>
