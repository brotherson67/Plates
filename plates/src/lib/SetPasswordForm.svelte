<script lang="ts">
  import { Block, BlockTitle, List, ListInput, Button } from 'konsta/svelte'
  import type { SupabaseClient } from '@supabase/supabase-js'
  import { setNewPassword, validateNewPassword } from './auth'

  export let client: SupabaseClient
  export let onDone: () => void = () => {}

  let password = ''
  let confirmPassword = ''
  let error: string | null = null
  let submitting = false

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault()
    error = validateNewPassword(password, confirmPassword)
    if (error) return

    submitting = true
    try {
      await setNewPassword(client, password)
      onDone()
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not set password.'
    } finally {
      submitting = false
    }
  }
</script>

<BlockTitle>Set your password</BlockTitle>
<form on:submit={handleSubmit} data-testid="set-password-form">
  <List strong inset>
    <ListInput label="New password" type="password" placeholder="New password" bind:value={password} required />
    <ListInput
      label="Confirm password"
      type="password"
      placeholder="Confirm new password"
      bind:value={confirmPassword}
      required
    />
  </List>
  {#if error}
    <Block strong inset>
      <p data-testid="set-password-error">{error}</p>
    </Block>
  {/if}
  <Block strong inset>
    <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Save password'}</Button>
  </Block>
</form>
