import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Skill {
  id: number
  name: string
  desc: string
  skill_type: string
  mcp_id: number | null
  timeout: number
  status: number
  create_time: string
}

export const useSkillStore = defineStore('skill', () => {
  const skills = ref<Skill[]>([])

  function setSkills(list: Skill[]) {
    skills.value = list
  }

  return { skills, setSkills }
})
