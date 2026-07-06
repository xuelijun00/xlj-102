<template>
  <div class="layout">
    <header class="header">
      <div class="header-left">
        <h1>实验室样本交接与复核工作台</h1>
      </div>
      <div class="header-right">
        <span>当前角色：{{ roleText }}</span>
        <span>用户：{{ user.name }}</span>
        <el-button type="danger" @click="$emit('logout')">退出登录</el-button>
      </div>
    </header>
    <main class="main">
      <ReceiverView v-if="user.role === 'sample_receiver'" />
      <InspectorView v-else-if="user.role === 'inspector'" />
      <QCLeaderView v-else-if="user.role === 'qc_leader'" />
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import ReceiverView from './ReceiverView.vue'
import InspectorView from './InspectorView.vue'
import QCLeaderView from './QCLeaderView.vue'

const props = defineProps({
  user: {
    type: Object,
    required: true
  }
})

defineEmits(['logout'])

const roleText = computed(() => {
  const map = {
    sample_receiver: '收样员',
    inspector: '检测员',
    qc_leader: '质控负责人'
  }
  return map[props.user.role] || props.user.role
})
</script>

<style scoped>
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.header-left h1 {
  font-size: 20px;
  font-weight: 600;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.header-right span {
  font-size: 14px;
}

.main {
  flex: 1;
  padding: 24px;
  background: #f5f5f5;
}
</style>
