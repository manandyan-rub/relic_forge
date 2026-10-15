<script lang="ts">
	import { type Snippet } from 'svelte';
	import { GlobalStyle } from 'components-ui-html';
	import Game from '../petal/SlotGame.svelte';
	import SessionGate from '../components/SessionGate.svelte';
	import { setContext } from '../game/context';

	type Props = { children: Snippet };
	const props: Props = $props();
	setContext();
</script>

<GlobalStyle>
	<SessionGate>
		<Game />
	</SessionGate>
</GlobalStyle>

{@render props.children()}

