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
            <el-table-column label="操作" width="200">
              <template #default="scope">
                <el-button type="primary" size="small" @click="handleReceive(scope.row)">接收</el-button>
                <el-button size="small" @click="openRecordTemp(scope.row)">录入温度</el-button>
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
            <el-table-column label="操作" width="250">
              <template #default="scope">
                <el-button size="small" @click="openEditForm(scope.row)">编辑进度</el-button>
                <el-button size="small" @click="openRecordTemp(scope.row)">录入温度</el-button>
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
            <el-table-column label="操作" width="250">
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
            <el-table-column label="操作" width="200">
              <template #default="scope">
                <el-button size="small" @click="showAudit(scope.row)">查看记录</el-button>
                <el-button size="small" @click="openRecordTemp(scope.row)">录入温度</el-button>
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
            <el-table-column prop="created_at" label="创建时间" />
            <el-table-column label="操作" width="250">
              <template #default="scope">
                <el-button size="small" @click="showIssueDetail(scope.row)">查看详情</el-button>
                <el-button type="primary" size="small" v-if="scope.row.status === 'pending_inspector'" @click="openInspectorAssess(scope.row)">评估影响</el-button>
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

    <el-dialog v-model="showRecordTemp" title="录入温度读数" width="500px">
      <el-form :model="tempForm" label-width="100px">
        <el-form-item label="样本编号">
          <el-input :value="currentSample?.sample_code" disabled />
        </el-form-item>
        <el-form-item label="样本类型">
          <el-input :value="currentSample?.sample_type" disabled />
        </el-form-item>
        <el-form-item label="温度读数(°C)" prop="temperature">
          <el-input-number v-model="tempForm.temperature" :precision="1" :step="0.5" placeholder="请输入温度" />
        </el-form-item>
        <el-form-item label="阶段" prop="stage">
          <el-select v-model="tempForm.stage">
            <el-option label="接收" value="receiving" />
            <el-option label="交接" value="handover" />
            <el-option label="检测前" value="before_inspection" />
            <el-option label="检测后" value="after_inspection" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRecordTemp = false">取消</el-button>
        <el-button type="primary" @click="handleRecordTemp">确认录入</el-button>
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

    <el-dialog v-model="showInspectorAssess" title="评估温度影响" width="500px">
      <el-form :model="assessForm" label-width="100px">
        <el-form-item label="样本编号">
          <el-input :value="currentIssueForAssess?.sample_code" disabled />
        </el-form-item>
        <el-form-item label="运输说明">
          <el-input :value="currentIssueForAssess?.transport_note || '无'" disabled type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="是否影响检测" prop="affects_inspection">
          <el-radio-group v-model="assessForm.affects_inspection">
            <el-radio :value="true">是，温度异常可能影响检测结果</el-radio>
            <el-radio :value="false">否，温度异常在可接受范围内</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showInspectorAssess = false">取消</el-button>
        <el-button type="primary" @click="handleSubmitAssess">确认评估</el-button>
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

const activeTab = ref('handover_assigned')
const samples = ref([])
const showEditForm = ref(false)
const showAuditDialog = ref(false)
const showRecordTemp = ref(false)
const showIssueDetail = ref(false)
const showInspectorAssess = ref(false)
const auditLogs = ref([])
const coldChainIssues = ref([])
const currentSample = ref(null)
const currentIssue = ref(null)
const currentIssueForAssess = ref(null)

const editForm = ref({
  progress: 'not_started',
  abnormal_note: ''
})

const tempForm = ref({
  temperature: '',
  stage: 'before_inspection'
})

const assessForm = ref({
  affects_inspection: false
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

const openRecordTemp = (row) => {
  currentSample.value = row
  tempForm.value = {
    temperature: '',
    stage: 'before_inspection'
  }
  showRecordTemp.value = true
}

const handleRecordTemp = async () => {
  if (!currentSample.value || tempForm.value.temperature === '') {
    alert('请填写温度读数')
    return
  }
  try {
    const res = await coldChainAPI.recordTemperature({
      sample_id: currentSample.value.id,
      temperature: tempForm.value.temperature,
      stage: tempForm.value.stage
    })
    showRecordTemp.value = false
    if (res.data.is_abnormal) {
      alert(`温度读数录入成功！该温度超出允许范围，已创建冷链异常记录。`)
    } else {
      alert('温度读数录入成功')
    }
    await loadColdChainIssues()
  } catch (err) {
    alert(err.response?.data?.error || '录入失败')
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

const openInspectorAssess = (row) => {
  currentIssueForAssess.value = row
  assessForm.value = {
    affects_inspection: false
  }
  showInspectorAssess.value = true
}

const handleSubmitAssess = async () => {
  if (!currentIssueForAssess.value) {
    alert('请选择要评估的异常记录')
    return
  }
  try {
    await coldChainAPI.submitInspectorAssess(currentIssueForAssess.value.id, {
      affects_inspection: assessForm.value.affects_inspection
    })
    showInspectorAssess.value = false
    alert('影响评估已提交，等待质控处置')
    await loadColdChainIssues()
  } catch (err) {
    alert(err.response?.data?.error || '提交失败')
  }
}

let ws = null

const connectWebSocket = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  ws = new WebSocket(`${protocol}//${window.location.host}/`)
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'subscribe', role: 'inspector' }))
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