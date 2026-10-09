<script lang="ts">
    import { presentAmount, type TransactionAmountDisplay } from '../../utils/transactionDisplay';
    export let value: number | string | null | undefined = null;
    export let display: TransactionAmountDisplay | null = null;
    export let currency = '';
    export let direction: 1 | -1 = 1;
    export let account = '';
    export let title: string | undefined = undefined;
    $: amount = display || presentAmount(value, currency, direction, account);
</script>

<span class="finance-amount {amount.color}" data-amount-value={amount.value} {title}>{amount.text}</span>

<style>
    .positive { color: var(--color-green); }
    .negative { color: var(--color-red); }
    .neutral { color: var(--text-muted); }
</style>
