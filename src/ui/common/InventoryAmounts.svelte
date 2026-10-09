<script lang="ts">
    import { presentInventoryAmounts } from '../../utils/transactionDisplay';
    import Amount from './Amount.svelte';
    export let value = '';
    export let account = '';
    export let direction: 1 | -1 = 1;
    $: amounts = presentInventoryAmounts(value, account, direction);
</script>

{#each amounts as amount}<span class="inventory-amount"><Amount display={amount} /></span>{/each}

<style>
    .inventory-amount { display: block; }
</style>
