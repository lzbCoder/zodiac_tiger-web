<script setup lang="ts">
import { ref, onMounted } from 'vue'
import GlassCard from '@/components/common/GlassCard.vue'
import { getLangSmithStatus, toggleLangSmith } from '@/api/settings'
import { getIntentDisplayList, saveIntentConfig } from '@/api/intent_display'
import type { IntentDisplayItem } from '@/api/intent_display'
import { ElMessage } from 'element-plus'

const activeMenu = ref('model')

const menus = [
  { key: 'model', label: '模型配置', icon: 'Cpu' },
  { key: 'cache', label: '缓存管理', icon: 'Coin' },
  { key: 'log', label: '日志配置', icon: 'Document' },
  { key: 'theme', label: '主题设置', icon: 'Brush' },
  { key: 'feature', label: '特性开关', icon: 'SwitchFilled' },
  { key: 'intent', label: '意图配置', icon: 'Opportunity' },
]

const modelForm = ref({
  model: 'qwen3-max',
  temperature: 0.7,
  maxTokens: 2048,
})

const cacheForm = ref({
  sessionTtl: 24,
  skillCache: true,
})

const logForm = ref({
  level: 'INFO',
  rotationSize: 10,
  retentionDays: 30,
})

// ---- 特性开关 ----
const langsmithEnabled = ref(false)
const langsmithProject = ref('')
const langsmithToggling = ref(false)

async function fetchLangSmith() {
  try {
    const res = await getLangSmithStatus()
    langsmithEnabled.value = res.data.enabled
    langsmithProject.value = res.data.project
  } catch {
    // handled by interceptor
  }
}

async function handleToggleLangSmith(): Promise<boolean> {
  langsmithToggling.value = true
  const next = !langsmithEnabled.value
  try {
    await toggleLangSmith(next)
    return true
  } catch {
    return false
  } finally {
    langsmithToggling.value = false
  }
}

// ---- 意图展示配置 ----
const intentList = ref<IntentDisplayItem[]>([])
const intentEditVisible = ref(false)
const intentEditForm = ref<IntentDisplayItem>({
  intent_key: '', show_name: '', intent_desc: '', demo_input: '', icon: '', sort: 0, enable: 1,
})

async function fetchIntentList() {
  try {
    const res: any = await getIntentDisplayList()
    intentList.value = (res.data || []) as IntentDisplayItem[]
  } catch {
    intentList.value = []
  }
}

function editIntent(item: IntentDisplayItem) {
  intentEditForm.value = { ...item }
  intentEditVisible.value = true
}

async function saveIntent() {
  try {
    await saveIntentConfig(intentEditForm.value)
    intentEditVisible.value = false
    ElMessage.success('保存成功')
    fetchIntentList()
  } catch { /* handled */ }
}

async function toggleIntent(item: IntentDisplayItem) {
  try {
    await saveIntentConfig({ intent_key: item.intent_key, enable: item.enable ? 0 : 1 })
    ElMessage.success(item.enable ? '已隐藏' : '已展示')
    fetchIntentList()
  } catch { /* handled */ }
}

function intentIcon(icon: string | null): string {
  if (icon === 'map') return '🗺️'
  if (icon === 'chart') return '📊'
  return '💬'
}

onMounted(() => {
  fetchLangSmith()
  fetchIntentList()
})
</script>

<template>
  <div class="setting-view">
    <GlassCard>
      <h2 class="text-glow-cyan" style="font-size:20px;letter-spacing:2px">系统设置</h2>
    </GlassCard>

    <div class="setting-body">
      <div class="setting-menu glass-card">
        <div
          v-for="item in menus"
          :key="item.key"
          class="setting-menu-item"
          :class="{ active: activeMenu === item.key }"
          @click="activeMenu = item.key"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </div>
      </div>

      <div class="setting-content">
        <!-- 模型配置 -->
        <GlassCard v-if="activeMenu === 'model'">
          <h3 class="section-title">模型参数配置</h3>
          <el-form :model="modelForm" label-position="top">
            <el-form-item label="模型名称">
              <el-input v-model="modelForm.model" disabled />
            </el-form-item>
            <el-form-item label="温度 (Temperature)">
              <el-slider v-model="modelForm.temperature" :min="0" :max="2" :step="0.1" show-input />
            </el-form-item>
            <el-form-item label="最大 Token 数">
              <el-input-number v-model="modelForm.maxTokens" :min="256" :max="8192" style="width:100%" />
            </el-form-item>
            <el-button type="primary">保存配置</el-button>
          </el-form>
        </GlassCard>

        <!-- 缓存管理 -->
        <GlassCard v-if="activeMenu === 'cache'">
          <h3 class="section-title">缓存管理</h3>
          <el-form :model="cacheForm" label-position="top">
            <el-form-item label="会话过期时间(小时)">
              <el-input-number v-model="cacheForm.sessionTtl" :min="1" :max="168" style="width:100%" />
            </el-form-item>
            <el-form-item label="启用技能热缓存">
              <el-switch v-model="cacheForm.skillCache" />
            </el-form-item>
            <el-button type="danger" plain>清除所有缓存</el-button>
          </el-form>
        </GlassCard>

        <!-- 日志配置 -->
        <GlassCard v-if="activeMenu === 'log'">
          <h3 class="section-title">日志配置</h3>
          <el-form :model="logForm" label-position="top">
            <el-form-item label="日志级别">
              <el-select v-model="logForm.level" style="width:100%">
                <el-option label="DEBUG" value="DEBUG" />
                <el-option label="INFO" value="INFO" />
                <el-option label="WARNING" value="WARNING" />
                <el-option label="ERROR" value="ERROR" />
              </el-select>
            </el-form-item>
            <el-form-item label="日志切割大小(MB)">
              <el-input-number v-model="logForm.rotationSize" :min="1" :max="100" style="width:100%" />
            </el-form-item>
            <el-form-item label="日志保留天数">
              <el-input-number v-model="logForm.retentionDays" :min="1" :max="90" style="width:100%" />
            </el-form-item>
            <el-button type="primary">保存配置</el-button>
          </el-form>
        </GlassCard>

        <!-- 主题设置 -->
        <GlassCard v-if="activeMenu === 'theme'">
          <h3 class="section-title">主题设置</h3>
          <p style="color:var(--text-secondary)">当前主题：科技霓虹 (深色)</p>
          <p style="color:var(--text-secondary);margin-top:8px">主色: #00EEFF | 辅助色: #7B61FF | 强调色: #FF4499</p>
        </GlassCard>

        <!-- 特性开关 -->
        <GlassCard v-if="activeMenu === 'feature'">
          <h3 class="section-title">特性开关</h3>
          <div class="feature-item">
            <div class="feature-info">
              <div class="feature-name">LangSmith 监控</div>
              <div class="feature-desc">追踪 LLM 调用全过程，记录 Agent 执行流程、延迟与 Token 消耗</div>
              <div class="feature-project">项目: <em>{{ langsmithProject }}</em></div>
            </div>
            <el-switch
              v-model="langsmithEnabled"
              :loading="langsmithToggling"
              :before-change="handleToggleLangSmith"
              size="large"
            />
          </div>

        </GlassCard>

        <!-- 意图配置 -->
        <GlassCard v-if="activeMenu === 'intent'">
          <h3 class="section-title">意图展示配置</h3>
          <p style="color:var(--text-secondary);font-size:13px;margin-bottom:16px">管理用户侧展示的能力名称、描述、示例话术，修改后前端自动生效。</p>
          <div v-for="item in intentList" :key="item.intent_key" class="feature-item">
            <div class="feature-info">
              <div class="feature-name">
                <span style="margin-right:6px">{{ intentIcon(item.icon) }}</span>
                {{ item.show_name }}
                <el-tag size="small" style="margin-left:8px">{{ item.intent_key }}</el-tag>
              </div>
              <div class="feature-desc">{{ item.intent_desc }}</div>
              <div class="feature-project">示例：<em>{{ item.demo_input }}</em></div>
            </div>
            <div style="display:flex;align-items:center;gap:12px;flex-shrink:0">
              <el-switch
                :model-value="item.enable === 1"
                @change="toggleIntent(item)"
                size="large"
              />
              <el-button size="small" text @click="editIntent(item)">编辑</el-button>
            </div>
          </div>
        </GlassCard>

        <!-- 意图配置编辑弹窗 -->
        <el-dialog
          v-model="intentEditVisible"
          title="编辑意图展示配置"
          width="560px"
          :close-on-click-modal="false"
        >
          <el-form :model="intentEditForm" label-position="top">
            <el-form-item label="意图Key">
              <el-input v-model="intentEditForm.intent_key" disabled />
            </el-form-item>
            <el-form-item label="展示名称">
              <el-input v-model="intentEditForm.show_name" placeholder="如：🗺️ 智能旅游规划" />
            </el-form-item>
            <el-form-item label="能力描述">
              <el-input v-model="intentEditForm.intent_desc" type="textarea" :rows="3" />
            </el-form-item>
            <el-form-item label="示例话术">
              <el-input v-model="intentEditForm.demo_input" type="textarea" :rows="2" />
            </el-form-item>
            <el-form-item label="排序">
              <el-input-number v-model="intentEditForm.sort" :min="0" :max="99" />
            </el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="intentEditVisible = false">取消</el-button>
            <el-button type="primary" @click="saveIntent">保存</el-button>
          </template>
        </el-dialog>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.setting-view {
  height: 100%;
  overflow-y: auto;
}

.setting-body {
  display: flex;
  gap: 20px;
  margin-top: 16px;
}

.setting-menu {
  width: 200px;
  padding: 12px;
  flex-shrink: 0;
}

.setting-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.3s;
  font-size: 14px;

  &:hover {
    background: rgba(0, 238, 255, 0.05);
    color: var(--text-primary);
  }

  &.active {
    background: rgba(0, 238, 255, 0.1);
    color: var(--neon-cyan);
  }
}

.setting-content {
  flex: 1;
}

.section-title {
  font-size: 16px;
  color: var(--neon-cyan);
  margin-bottom: 20px;
  letter-spacing: 2px;
}

:deep(.el-form) {
  max-width: 500px;
}

.feature-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 20px;
  border: 1px solid rgba(0, 238, 255, 0.12);
  border-radius: 10px;
  background: rgba(0, 238, 255, 0.03);
  transition: border-color 0.3s, background 0.3s;

  &:hover {
    border-color: rgba(0, 238, 255, 0.25);
    background: rgba(0, 238, 255, 0.05);
  }
}

.feature-info {
  flex: 1;
}

.feature-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.feature-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 6px;
}

.feature-project {
  font-size: 12px;
  color: var(--text-secondary);

  em {
    font-style: normal;
    color: var(--color-primary);
  }
}
</style>
