import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getIntentDisplayList } from '@/api/intent_display'
import type { IntentDisplayItem } from '@/api/intent_display'

export const useIntentDisplayStore = defineStore('intentDisplay', () => {
  const list = ref<IntentDisplayItem[]>([])

  async function fetchList() {
    try {
      const res: any = await getIntentDisplayList()
      list.value = (res.data || []) as IntentDisplayItem[]
    } catch {
      list.value = []
    }
  }

  return { list, fetchList }
})
