<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  visible: boolean
  data?: Record<string, any> | null
}>()

const emit = defineEmits<{
  close: []
  save: [data: Record<string, any>]
}>()

const form = ref({
  id: null as number | null,
  name: '',
  category: 'common',
  content: '',
  status: 1,
})

watch(() => props.visible, (v) => {
  if (v && props.data) {
    form.value = { id: props.data.id ?? null, name: props.data.name || '', category: props.data.category || 'common', content: props.data.content || '', status: props.data.status ?? 1 }
  } else if (v) {
    form.value = { id: null, name: '', category: 'common', content: '', status: 1 }
  }
})

function handleSave() {
  emit('save', { ...form.value })
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    :title="form.id ? '编辑模板' : '新建模板'"
    width="600px"
    @close="$emit('close')"
    :close-on-click-modal="false"
  >
    <el-form :model="form" label-position="top">
      <el-form-item label="模板名称">
        <el-input v-model="form.name" placeholder="输入模板名称" />
      </el-form-item>
      <el-form-item label="分类">
        <el-select v-model="form.category" style="width:100%">
          <el-option label="通用对话" value="common" />
          <el-option label="数据报表" value="report" />
          <el-option label="旅游规划" value="travel" />
          <el-option label="智能助手" value="assistant" />
        </el-select>
      </el-form-item>
      <el-form-item label="模板内容 (使用 {{变量名}} 定义变量)">
        <el-input v-model="form.content" type="textarea" rows="8" placeholder="输入模板内容..." />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="$emit('close')">取消</el-button>
      <el-button type="primary" @click="handleSave">保存</el-button>
    </template>
  </el-dialog>
</template>
