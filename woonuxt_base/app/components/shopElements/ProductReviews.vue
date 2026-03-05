<script setup>
const props = defineProps({
  product: { type: Object, default: null },
});

const isAvatarUsable = (url?: string) => {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.hostname.includes('gravatar.com')) {
      const d = u.searchParams.get('d');
      if ((d || '').toLowerCase() === 'mm') return false;
    }
  } catch {
    return false;
  }
  return true;
};

const maskName = (name?: string) => {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] || '';
  const first = parts.slice(0, -1).join(' ');
  const last = parts[parts.length - 1] || '';
  const lastInitial = last[0] ? last[0].toUpperCase() : '';
  return `${first} ${lastInitial}`;
};

const firstInitial = (name?: string) => {
  if (!name) return '';
  const first = name.trim().split(/\s+/)[0] || '';
  return first[0] ? first[0].toUpperCase() : '';
};
</script>

<template>
  <div class="flex flex-wrap gap-32 items-start mt-8">
    <div class="flex max-w-sm gap-4 prose dark:prose-invert">
      <ReviewsScore v-if="product.reviews" :reviews="product.reviews" :productId="product.databaseId" :reviewCount="product.reviewCount" />
    </div>
    <div class="divide-y divide-gray-200 dark:divide-gray-700 flex-1" v-if="product.reviews?.edges && product.reviews.edges.length">
      <div v-for="review in product.reviews.edges" :key="review.id" class="my-2 py-8">
        <div class="flex gap-4 items-center">
          <img
            v-if="isAvatarUsable(review.node.author.node.avatar?.url)"
            :src="review.node.author.node.avatar.url"
            class="rounded-full h-12 w-12"
          />
          <div
            v-else
            class="rounded-full h-12 w-12 flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold"
          >
            {{ firstInitial(review.node.author.node.name) }}
          </div>
          <div class="grid gap-1">
            <div class="text-sm">
              <span class="font-semibold dark:text-gray-200">{{ maskName(review.node.author.node.name) }}</span>
              <span class="italic text-gray-400 dark:text-gray-500">
                – {{ new Date(review.node.date).toLocaleString($t('general.langCode'), { month: 'long', day: 'numeric', year: 'numeric' }) }}</span
              >
            </div>
            <StarRating :rating="review.rating" :hide-count="true" class="text-sm" />
          </div>
        </div>
        <div class="mt-4 text-gray-700 dark:text-gray-300 italic prose-sm dark:prose-invert" v-html="review.node.content"></div>
      </div>
    </div>
  </div>
</template>
