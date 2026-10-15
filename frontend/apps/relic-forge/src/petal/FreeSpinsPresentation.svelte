<script lang="ts">
 let { active, remaining, total }: { active: boolean; remaining: number; total: string } = $props();
</script>
{#if active}<div class="free-spins-banner" role="status"><span>THE PETALS AWAKEN</span><strong>{remaining} free spins</strong><span>Feature win {total}</span></div>{/if}
