<template>
  <div class="inspector-view">
    <el-card>
      <div class="card-header">
        <h2>检测工作台</h2>
      </div>
      
      <el-tabs v-model="activeTab">
        <el-tab-pane label="待接收" name="handover_assigned">
          <el-table :data="assignedSamples">
            <el-table-column prop="sample_code" label="样本编号" />
            <el-table-column prop="source_unit" label="来源单位" />
            <el-table-column prop="sample_type" label="样本类型" />
            <el-table-column prop="test_items" label="送检项目" />
            <el-table-column prop="received_at" label="接收时间" />
            <el-table-column prop="version" label="版本" width="80" />
            <el-table-column label="操作" width="150">
              <template #default="scope">
                <el-button type="primary" size="small" @click="handleReceive(scope.row)">接收</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
        
        <el-tab-pane label="检测中" name="inspection_in_progress">
          <el-table :data="inProgressSamples">
            <el-table-column prop="sample_code" label="样本编号" />
            <el-table-column prop="source_unit" label="来源单位" />
            <el-table-column prop="sample_type" label="样本类型" />
            <el-table-column prop="test_items" label="送检项目" />
            <el-table-column prop="progress" label="进度">
              <template #default="scope">
                <el-tag :type="progressType(scope.row.progress)">
                  {{ progressText(scope.row.progress) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="version" label="版本" width="80" />
            <el-table-column label="操作" width="200">
              <template #default="scope">
                <el-button size="small" @click="openEditForm(scope.row)">编辑进度</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
        
        <el-tab-pane label="待重新提交" name="review_returned">
          <el-table :data="returnedSamples">
            <el-table-column prop="sample_code" label="样本编号" />
            <el-table-column prop="source_unit" label="来源单位" />
            <el-table-column prop="sample_type" label="样本类型" />
            <el-table-column prop="test_items" label="送检项目" />
            <el-table-column prop="version" label="版本" width="80" />
            <el-table-column label="操作" width="200">
              <template #default="scope">
                <el-button size="small" @click="openEditForm(scope.row)">编辑进度</el-button>
                <el-button type="primary" size="small" @click="handleResubmit(scope.row)">重新提交</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
        
        <el-tab-pane label="已提交复核" name="pending_review">
          <el-table :data="pendingReviewSamples">
            <el-table-column prop="sample_code" label="样本编号" />
            <el-table-column prop="source_unit" label="来源单位" />
            <el-table-column prop="sample_type" label="样本类型" />
            <el-table-column prop="test_items" label="送检项目" />
            <el-table-column label="操作" width="150">
              <template #default="scope">
                <el-button size="small" @click="showAudit(scope.row)">查看记录</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-dialog v-model="showEditForm" title="编辑检测进度" width="500px">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="检测进度">
          <el-select v-model="editForm.progress">
            <el-option label="未开始" value="not_started" />
            <el-option label="进行中" value="in_progress" />
            <el-option label="已完成" value="completed" />
          </el-select>
        </el-form-item>
        <el-form-item label="异常说明">
          <el-input v-model="editForm.abnormal_note" type="textarea" :rows="4" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditForm = false">取消</el-button>
        <el-button type="primary" @click="handleUpdateProgress">更新进度</el-button>
        <el-button type="success" @click="handleSubmitForReview" :disabled="editForm.progress !== 'completed'">提交复核</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showAuditDialog" title="操作记录" width="600px">
      <el-table :data="auditLogs">
        <el-table-column prop="created_at" label="时间" />
        <el-table-column prop="user_name" label="操作人" />
        <el-table-column prop="action" label="操作" />
        <el-table-column prop="from_state" label="原状态" />
        <el-table-column prop="to_state" label="新状态" />
        <el-table-column prop="detail" label="详情" />
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { sampleAPI } from '../utils/api'

const activeTab = ref('handover_assigned')
const samples = ref([])
const showEditForm = ref(false)
const showAuditDialog = ref(false)
const auditLogs = ref([])
const currentSample = ref(null)

const editForm = ref({
  progress: 'not_started',
  abnormal_note: ''
})

const assignedSamples = computed(() => samples.value.filter(s => s.status === 'handover_assigned'))
const inProgressSamples = computed(() => samples.value.filter(s => s.status === 'inspection_in_progress'))
const returnedSamples = computed(() => samples.value.filter(s => s.status === 'review_returned'))
const pendingReviewSamples = computed(() => samples.value.filter(s => s.status === 'pending_review'))

const progressText = (p) => {
  const map = { not_started: '未开始', in_progress: '进行中', completed: '已完成' }
  return map[p] || p
}

const progressType = (p) => {
  const map = { not_started: 'info', in_progress: 'warning', completed: 'success' }
  return map[p] || 'info'
}

const loadSamples = async () => {
  try {
    const res = await sampleAPI.list()
    samples.value = res.data
  } catch (err) {
    console.error('加载样本失败', err)
  }
}

const handleReceive = async (row) => {
  try {
    await sampleAPI.receive(row.id, row.version)
    await loadSamples()
    alert('样本接收成功')
  } catch (err) {
    alert(err.response?.data?.error || '接收失败')
  }
}

const openEditForm = (row) => {
  currentSample.value = row
  editForm.value = {
    progress: 'not_started',
    abnormal_note: ''
  }
  showEditForm.value = true
}

const handleUpdateProgress = async () => {
  if (!currentSample.value) return
  try {
    await sampleAPI.updateProgress(currentSample.value.id, {
      ...editForm.value,
      version: currentSample.value.version
    })
    await loadSamples()
    showEditForm.value = false
    alert('进度更新成功')
  } catch (err) {
    alert(err.response?.data?.error || '更新失败')
  }
}

const handleSubmitForReview = async () => {
  if (!currentSample.value) return
  try {
    await sampleAPI.submitForReview(currentSample.value.id, currentSample.value.version)
    await loadSamples()
    showEditForm.value = false
    alert('样本已提交复核')
  } catch (err) {
    alert(err.response?.data?.error || '提交失败')
  }
}

const handleResubmit = async (row) => {
  try {
    await sampleAPI.resubmit(row.id, row.version)
    await loadSamples()
    alert('样本已重新提交')
  } catch (err) {
    alert(err.response?.data?.error || '重新提交失败')
  }
}

const showAudit = async (row) => {
  try {
    const res = await sampleAPI.getAuditLogs(row.id)
    auditLogs.value = res.data
    showAuditDialog.value = true
  } catch (err) {
    alert(err.response?.data?.error || '获取记录失败')
  }
}

let ws = null

const connectWebSocket = () => {
  ws = new WebSocket('ws://localhost:3000')
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'subscribe', role: 'inspector' }))
  }
  ws.onmessage = () => {
    loadSamples()
  }
  ws.onerror = () => {
    setTimeout(connectWebSocket, 5000)
  }
  ws.onclose = () => {
    setTimeout(connectWebSocket, 5000)
  }
}

onMounted(() => {
  loadSamples()
  connectWebSocket()
})

onUnmounted(() => {
  if (ws) ws.close()
})
</script>

<style scoped>
.inspector-view {
  max-width: 1400px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.card-header h2 {
  font-size: 18px;
  font-weight: 600;
}
</style>
