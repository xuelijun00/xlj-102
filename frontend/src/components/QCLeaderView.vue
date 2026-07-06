<template>
  <div class="qc-view">
    <el-card>
      <div class="card-header">
        <h2>质控复核工作台</h2>
      </div>
      
      <el-tabs v-model="activeTab">
        <el-tab-pane label="待复核" name="pending_review">
          <el-table :data="pendingSamples">
            <el-table-column prop="sample_code" label="样本编号" />
            <el-table-column prop="source_unit" label="来源单位" />
            <el-table-column prop="sample_type" label="样本类型" />
            <el-table-column prop="test_items" label="送检项目" />
            <el-table-column prop="current_owner_name" label="检测员" />
            <el-table-column prop="version" label="版本" width="80" />
            <el-table-column label="操作" width="250">
              <template #default="scope">
                <el-button size="small" @click="openReviewForm(scope.row)">处理</el-button>
                <el-button size="small" @click="showAudit(scope.row)">查看记录</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
        
        <el-tab-pane label="已通过" name="review_passed">
          <el-table :data="passedSamples">
            <el-table-column prop="sample_code" label="样本编号" />
            <el-table-column prop="source_unit" label="来源单位" />
            <el-table-column prop="sample_type" label="样本类型" />
            <el-table-column prop="test_items" label="送检项目" />
            <el-table-column prop="current_owner_name" label="检测员" />
            <el-table-column label="操作" width="150">
              <template #default="scope">
                <el-button size="small" @click="showAudit(scope.row)">查看记录</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
        
        <el-tab-pane label="已退回" name="review_returned">
          <el-table :data="returnedSamples">
            <el-table-column prop="sample_code" label="样本编号" />
            <el-table-column prop="source_unit" label="来源单位" />
            <el-table-column prop="sample_type" label="样本类型" />
            <el-table-column prop="test_items" label="送检项目" />
            <el-table-column prop="current_owner_name" label="检测员" />
            <el-table-column label="操作" width="150">
              <template #default="scope">
                <el-button size="small" @click="showAudit(scope.row)">查看记录</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
        
        <el-tab-pane label="已作废" name="cancelled">
          <el-table :data="cancelledSamples">
            <el-table-column prop="sample_code" label="样本编号" />
            <el-table-column prop="source_unit" label="来源单位" />
            <el-table-column prop="sample_type" label="样本类型" />
            <el-table-column prop="test_items" label="送检项目" />
            <el-table-column prop="current_owner_name" label="检测员" />
            <el-table-column label="操作" width="150">
              <template #default="scope">
                <el-button size="small" @click="showAudit(scope.row)">查看记录</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-dialog v-model="showReviewForm" title="复核处理" width="500px">
      <el-form :model="reviewForm" label-width="100px">
        <el-form-item label="处理结果">
          <el-select v-model="reviewForm.result">
            <el-option label="通过" value="passed" />
            <el-option label="退回补充说明" value="returned" />
            <el-option label="标记作废" value="cancelled" />
          </el-select>
        </el-form-item>
        <el-form-item label="复核意见">
          <el-input v-model="reviewForm.review_note" type="textarea" :rows="4" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showReviewForm = false">取消</el-button>
        <el-button type="primary" @click="handleReview">确认处理</el-button>
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

const activeTab = ref('pending_review')
const samples = ref([])
const showReviewForm = ref(false)
const showAuditDialog = ref(false)
const auditLogs = ref([])
const currentSample = ref(null)

const reviewForm = ref({
  result: '',
  review_note: ''
})

const pendingSamples = computed(() => samples.value.filter(s => s.status === 'pending_review'))
const passedSamples = computed(() => samples.value.filter(s => s.status === 'review_passed'))
const returnedSamples = computed(() => samples.value.filter(s => s.status === 'review_returned'))
const cancelledSamples = computed(() => samples.value.filter(s => s.status === 'cancelled'))

const loadSamples = async () => {
  try {
    const res = await sampleAPI.list()
    samples.value = res.data
  } catch (err) {
    console.error('加载样本失败', err)
  }
}

const openReviewForm = (row) => {
  currentSample.value = row
  reviewForm.value = {
    result: '',
    review_note: ''
  }
  showReviewForm.value = true
}

const handleReview = async () => {
  if (!currentSample.value || !reviewForm.value.result) {
    alert('请选择处理结果')
    return
  }
  try {
    await sampleAPI.review(currentSample.value.id, {
      ...reviewForm.value,
      version: currentSample.value.version
    })
    await loadSamples()
    showReviewForm.value = false
    alert('复核处理完成')
  } catch (err) {
    alert(err.response?.data?.error || '处理失败')
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
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  ws = new WebSocket(`${protocol}//${window.location.host}/`)
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'subscribe', role: 'qc_leader' }))
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
.qc-view {
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
