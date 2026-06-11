import api from './index'

export interface IntentDisplayItem {
  intent_key: string
  show_name: string
  intent_desc: string
  demo_input: string
  icon: string | null
  sort: number
  enable: number
}

export function getIntentDisplayList() {
  return api.get('/intent/display/list')
}

export function saveIntentConfig(data: {
  intent_key: string
  show_name?: string
  intent_desc?: string
  demo_input?: string
  icon?: string
  sort?: number
  enable?: number
}) {
  return api.post('/intent/display/save', data)
}
