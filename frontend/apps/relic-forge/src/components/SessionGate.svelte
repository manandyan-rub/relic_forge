<script lang="ts">
	import { type Snippet } from 'svelte';
	import Authenticate from '../petal/SessionAuthenticate.svelte';
	import { stateUrlDerived } from 'state-shared';

	type Props = { children: Snippet };
	const props: Props = $props();
	const hasSession = $derived(Boolean(stateUrlDerived.sessionID() && stateUrlDerived.rgsUrl()));
	const partialSession = $derived(
		Boolean(stateUrlDerived.sessionID()) !== Boolean(stateUrlDerived.rgsUrl()),
	);
	const explicitMock = $derived(import.meta.env.DEV && stateUrlDerived.demo() && !hasSession && !partialSession);
	const requiresRgsSession = $derived(hasSession || stateUrlDerived.replay());
</script>

{#if requiresRgsSession}
	<Authenticate>{@render props.children()}</Authenticate>
{:else if explicitMock}
	{@render props.children()}
{:else}
	<main class="session-error" role="alert">
		<h1>The Last Petal</h1>
		<p>
			{partialSession
				? 'This session is incomplete. Both sessionID and rgs_url are required.'
				: 'A Stake session is required. Add ?demo=true only in local development.'}
		</p>
	</main>
{/if}

<style>
	.session-error {
		display: grid;
		min-height: 100vh;
		place-content: center;
		padding: 24px;
		background: #050908;
		color: #f4e8c7;
		font-family: var(--font-ui);
		text-align: center;
	}
	.session-error h1 { color: #f4c95d; }
	.session-error p { max-width: 520px; color: #c9b982; line-height: 1.5; }
</style>


