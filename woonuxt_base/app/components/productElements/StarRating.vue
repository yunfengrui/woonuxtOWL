<script setup lang="ts">
const props = defineProps({
  rating: { type: Number, default: 0 },
  count: { type: Number, default: null },
  hideCount: { type: Boolean, default: false },
  size: { type: Number, default: 14 },
});

const display = computed(() => {
  const r = Number(props.rating || 0);
  if (r > 4.6) return { full: 5, half: 0 };
  if (r > 4.2) return { full: 4, half: 1 };
  return { full: Math.floor(r), half: 0 };
});
</script>

<template>
  <div class="inline-flex items-center">
    <Icon
      v-for="i in 5"
      :key="i"
      :name="i <= display.full ? 'ion:star' : i === display.full + 1 && display.half ? 'ion:star-half' : 'ion:star'"
      :size="size + ''"
      class="mr-0.5"
      :style="{ color: i <= display.full || (i === display.full + 1 && display.half) ? '#FBBE24' : '#ccc' }" />
    <span v-if="count !== null && !hideCount" class="text-xs ml-1 text-gray-500 dark:text-gray-400">({{ count }})</span>
  </div>
</template>
