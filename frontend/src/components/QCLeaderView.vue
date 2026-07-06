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

        <el-tab-pane label="冷链异常" name="cold_chain">
          <el-table :data="coldChainIssues">
            <el-table-column prop="sample_code" label="样本编号" />
            <el-table-column prop="sample_type" label="样本类型" />
            <el-table-column prop="source_unit" label="来源单位" />
            <el-table-column prop="status" label="状态">
              <template #default="scope">
                <el-tag :type="statusTagType(scope.row.status)">{{ scope.row.status_label }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="affects_inspection" label="影响检测">
              <template #default="scope">
                <el-tag :type="scope.row.affects_inspection === 1 ? 'danger' : 'success'">
                  {{ scope.row.affects_inspection === 1 ? '是' : (scope.row.affects_inspection === 0 ? '否' : '未评估') }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="创建时间" />
            <el-table-column label="操作" width="250">
              <template #default="scope">
                <el-button size="small" @click="showIssueDetail(scope.row)">查看详情</el-button>
                <el-button type="primary" size="small" v-if="scope.row.status === 'pending_qc'" @click="openFinalDisposition(scope.row)">给出处置</el-button>
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

    <el-dialog v-model="showIssueDetail" title="冷链异常详情" width="700px">
      <div v-if="currentIssue">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="样本编号">{{ currentIssue.sample_code }}</el-descriptions-item>
          <el-descriptions-item label="样本类型">{{ currentIssue.sample_type }}</el-descriptions-item>
          <el-descriptions-item label="来源单位">{{ currentIssue.source_unit }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="statusTagType(currentIssue.status)">{{ currentIssue.status_label }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="运输说明" :span="2">
            {{ currentIssue.transport_note || '未填写' }}
            <span v-if="currentIssue.transport_note_by_name">（{{ currentIssue.transport_note_by_name }} 于 {{ currentIssue.transport_note_at }}）</span>
          </el-descriptions-item>
          <el-descriptions-item label="是否影响检测" :span="2">
            <el-tag :type="currentIssue.affects_inspection === 1 ? 'danger' : 'success'">
              {{ currentIssue.affects_inspection === 1 ? '是' : (currentIssue.affects_inspection === 0 ? '否' : '未评估') }}
            </el-tag>
            <span v-if="currentIssue.affects_inspection_by_name">（{{ currentIssue.affects_inspection_by_name }} 于 {{ currentIssue.affects_inspection_at }}）</span>
          </el-descriptions-item>
          <el-descriptions-item label="最终处置" :span="2">
            <el-tag v-if="currentIssue.final_disposition" :type="dispositionTagType(currentIssue.final_disposition)">
              {{ currentIssue.final_disposition_label }}
            </el-tag>
            <span v-else>未处置</span>
            <span v-if="currentIssue.final_disposition_by_name">（{{ currentIssue.final_disposition_by_name }} 于 {{ currentIssue.final_disposition_at }}）</span>
          </el-descriptions-item>
        </el-descriptions>
        <div style="margin-top: 20px;">
          <h4>温度时间线</h4>
          <div v-if="currentIssue.abnormal_readings && currentIssue.abnormal_readings.length > 0">
            <div v-for="(reading, index) in currentIssue.abnormal_readings" :key="reading.id" class="timeline-item">
              <div class="timeline-dot abnormal"></div>
              <div class="timeline-content">
                <span class="timeline-time">{{ reading.recorded_at }}</span>
                <span class="timeline-stage">[{{ reading.stage_label }}]</span>
                <span class="timeline-temp" :class="{ abnormal: reading.is_abnormal === 1 }">{{ reading.temperature }}°C</span>
                <span class="timeline-operator">记录人：{{ reading.recorded_by_name }}</span>
              </div>
            </div>
          </div>
          <div v-else>
            <el-empty description="暂无温度记录" />
          </div>
        </div>
      </div>
    </el-dialog>

    <el-dialog v-model="showFinalDisposition" title="最终处置结论" width="500px">
      <el-form :model="dispositionForm" label-width="100px">
        <el-form-item label="样本编号">
          <el-input :value="currentIssueForDisposition?.sample_code" disabled />
        </el-form-item>
        <el-form-item label="运输说明">
          <el-input :value="currentIssueForDisposition?.transport_note || '无'" disabled type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="是否影响检测">
          <el-tag :type="currentIssueForDisposition?.affects_inspection === 1 ? 'danger' : 'success'">
            {{ currentIssueForDisposition?.affects_inspection === 1 ? '是' : (currentIssueForDisposition?.affects_inspection === 0 ? '否' : '未评估') }}
          </el-tag>
        </el-form-item>
        <el-form-item label="处置结论" prop="final_disposition">
          <el-select v-model="dispositionForm.final_disposition">
            <el-option label="继续检测" value="continue" />
            <el-option label="重新取样" value="resample" />
            <el-option label="作废" value="discard" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showFinalDisposition = false">取消</el-button>
        <el-button type="primary" @click="handleSubmitDisposition">确认处置</el-button>
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
import { sampleAPI, coldChainAPI } from '../utils/api'

const activeTab = ref('pending_review')
const samples = ref([])
const showReviewForm = ref(false)
const showAuditDialog = ref(false)
const showIssueDetail = ref(false)
const showFinalDisposition = ref(false)
const auditLogs = ref([])
const coldChainIssues = ref([])
const currentSample = ref(null)
const currentIssue = ref(null)
const currentIssueForDisposition = ref(null)

const reviewForm = ref({
  result: '',
  review_note: ''
})

const dispositionForm = ref({
  final_disposition: ''
})

const pendingSamples = computed(() => samples.value.filter(s => s.status === 'pending_review'))
const passedSamples = computed(() => samples.value.filter(s => s.status === 'review_passed'))
const returnedSamples = computed(() => samples.value.filter(s => s.status === 'review_returned'))
const cancelledSamples = computed(() => samples.value.filter(s => s.status === 'cancelled'))

const statusTagType = (status) => {
  const map = {
    'pending_receiver': 'warning',
    'pending_inspector': 'info',
    'pending_qc': 'danger',
    'resolved': 'success'
  }
  return map[status] || 'info'
}

const dispositionTagType = (disposition) => {
  const map = {
    'continue': 'success',
    'resample': 'warning',
    'discard': 'danger'
  }
  return map[disposition] || 'info'
}

const loadSamples = async () => {
  try {
    const res = await sampleAPI.list()
    samples.value = res.data
  } catch (err) {
    console.error('加载样本失败', err)
  }
}

const loadColdChainIssues = async () => {
  try {
    const res = await coldChainAPI.getAllIssues()
    coldChainIssues.value = res.data
  } catch (err) {
    console.error('加载冷链异常失败', err)
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

const showIssueDetail = async (row) => {
  try {
    const res = await coldChainAPI.getIssue(row.id)
    currentIssue.value = res.data
    showIssueDetail.value = true
  } catch (err) {
    alert(err.response?.data?.error || '获取详情失败')
  }
}

const openFinalDisposition = (row) => {
  currentIssueForDisposition.value = row
  dispositionForm.value = {
    final_disposition: ''
  }
  showFinalDisposition.value = true
}

const handleSubmitDisposition = async () => {
  if (!currentIssueForDisposition.value || !dispositionForm.value.final_disposition) {
    alert('请选择处置结论')
    return
  }
  try {
    await coldChainAPI.submitFinalDisposition(currentIssueForDisposition.value.id, {
      final_disposition: dispositionForm.value.final_disposition
    })
    showFinalDisposition.value = false
    alert('最终处置结论已提交')
    await loadColdChainIssues()
    await loadSamples()
  } catch (err) {
    alert(err.response?.data?.error || '提交失败')
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
    loadColdChainIssues()
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
  loadColdChainIssues()
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

.timeline-item {
  display: flex;
  margin-bottom: 12px;
}

.timeline-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #E6A23C;
  margin-right: 12px;
  margin-top: 4px;
  flex-shrink: 0;
}

.timeline-dot.abnormal {
  background: #F56C6C;
}

.timeline-content {
  flex: 1;
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 4px;
}

.timeline-time {
  font-weight: 600;
  margin-right: 8px;
}

.timeline-stage {
  color: #909399;
  margin-right: 8px;
}

.timeline-temp {
  font-weight: 600;
  color: #67C23A;
  margin-right: 12px;
}

.timeline-temp.abnormal {
  color: #F56C6C;
}

.timeline-operator {
  color: #909399;
  font-size: 12px;
}
</style>