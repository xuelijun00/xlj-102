<template>
  <div class="receiver-view">
    <el-card>
      <div class="card-header">
        <h2>收样工作台</h2>
        <el-button type="primary" @click="showAddForm = true">录入新样本</el-button>
      </div>
      
      <el-tabs v-model="activeTab">
        <el-tab-pane label="待交接" name="pending_handover">
          <el-table :data="pendingSamples" @selection-change="handleSelectionChange">
            <el-table-column type="selection" width="50" />
            <el-table-column prop="sample_code" label="样本编号" />
            <el-table-column prop="source_unit" label="来源单位" />
            <el-table-column prop="sample_type" label="样本类型" />
            <el-table-column prop="test_items" label="送检项目" />
            <el-table-column prop="received_at" label="接收时间" />
            <el-table-column prop="version" label="版本" width="80" />
            <el-table-column label="操作" width="200">
              <template #default="scope">
                <el-button size="small" @click="showAudit(scope.row)">查看记录</el-button>
                <el-button size="small" @click="openRecordTemp(scope.row)">录入温度</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="pendingSamples.length > 0" class="batch-action">
            <span>已选择 {{ selectedSamples.length }} 个样本</span>
            <el-select v-model="selectedInspector" placeholder="选择检测员" style="width: 200px; margin-left: 10px">
              <el-option v-for="insp in inspectors" :key="insp.id" :label="insp.name" :value="insp.id" />
            </el-select>
            <el-button type="primary" @click="handleAssign" :disabled="selectedSamples.length === 0 || !selectedInspector">
              批量分配
            </el-button>
          </div>
        </el-tab-pane>
        <el-tab-pane label="已分配" name="handover_assigned">
          <el-table :data="assignedSamples">
            <el-table-column prop="sample_code" label="样本编号" />
            <el-table-column prop="source_unit" label="来源单位" />
            <el-table-column prop="sample_type" label="样本类型" />
            <el-table-column prop="current_owner_name" label="负责人" />
            <el-table-column prop="received_at" label="接收时间" />
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
            <el-table-column label="操作" width="200">
              <template #default="scope">
                <el-button size="small" @click="showIssueDetail(scope.row)">查看详情</el-button>
                <el-button type="primary" size="small" v-if="scope.row.status === 'pending_receiver'" @click="openReceiverNote(scope.row)">处理</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-dialog v-model="showAddForm" title="录入样本" width="500px">
      <el-form :model="addForm" :rules="addRules" ref="addFormRef" label-width="100px">
        <el-form-item label="来源单位" prop="source_unit">
          <el-input v-model="addForm.source_unit" />
        </el-form-item>
        <el-form-item label="样本类型" prop="sample_type">
          <el-select v-model="addForm.sample_type">
            <el-option label="血液" value="血液" />
            <el-option label="尿液" value="尿液" />
            <el-option label="血清" value="血清" />
            <el-option label="痰液" value="痰液" />
            <el-option label="脑脊液" value="脑脊液" />
            <el-option label="其他" value="其他" />
          </el-select>
        </el-form-item>
        <el-form-item label="送检项目" prop="test_items">
          <el-input v-model="addForm.test_items" />
        </el-form-item>
        <el-form-item label="接收时间" prop="received_at">
          <el-date-picker v-model="addForm.received_at" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddForm = false">取消</el-button>
        <el-button type="primary" @click="handleAdd">确定</el-button>
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

    <el-dialog v-model="showReceiverNote" title="补充运输说明" width="500px">
      <el-form :model="receiverNoteForm" label-width="100px">
        <el-form-item label="样本编号">
          <el-input :value="currentIssueForNote?.sample_code" disabled />
        </el-form-item>
        <el-form-item label="运输说明" prop="transport_note">
          <el-input v-model="receiverNoteForm.transport_note" type="textarea" :rows="4" placeholder="请描述运输过程中的温度异常情况及原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showReceiverNote = false">取消</el-button>
        <el-button type="primary" @click="handleSubmitReceiverNote">提交说明</el-button>
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
import { sampleAPI, userAPI, coldChainAPI } from '../utils/api'

const activeTab = ref('pending_handover')
const samples = ref([])
const selectedSamples = ref([])
const selectedInspector = ref(null)
const inspectors = ref([])
const showAddForm = ref(false)
const showAuditDialog = ref(false)
const showRecordTemp = ref(false)
const showIssueDetail = ref(false)
const showReceiverNote = ref(false)
const auditLogs = ref([])
const coldChainIssues = ref([])
const addFormRef = ref(null)

const currentSample = ref(null)
const currentIssue = ref(null)
const currentIssueForNote = ref(null)

const addForm = ref({
  source_unit: '',
  sample_type: '',
  test_items: '',
  received_at: ''
})

const tempForm = ref({
  temperature: '',
  stage: 'receiving'
})

const receiverNoteForm = ref({
  transport_note: ''
})

const addRules = {
  source_unit: [{ required: true, message: '请输入来源单位', trigger: 'blur' }],
  sample_type: [{ required: true, message: '请选择样本类型', trigger: 'change' }],
  test_items: [{ required: true, message: '请输入送检项目', trigger: 'blur' }],
  received_at: [{ required: true, message: '请选择接收时间', trigger: 'change' }]
}

const pendingSamples = computed(() => samples.value.filter(s => s.status === 'pending_handover'))
const assignedSamples = computed(() => samples.value.filter(s => s.status === 'handover_assigned'))

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

const loadInspectors = async () => {
  try {
    const res = await userAPI.getInspectors()
    inspectors.value = res.data
  } catch (err) {
    console.error('加载检测员失败', err)
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

const handleSelectionChange = (val) => {
  selectedSamples.value = val
}

const handleAdd = async () => {
  if (!addFormRef.value) return
  await addFormRef.value.validate(async (valid) => {
    if (!valid) return
    try {
      await sampleAPI.create(addForm.value)
      showAddForm.value = false
      addForm.value = { source_unit: '', sample_type: '', test_items: '', received_at: '' }
      await loadSamples()
      alert('样本录入成功')
    } catch (err) {
      alert(err.response?.data?.error || '录入失败')
    }
  })
}

const handleAssign = async () => {
  const ids = selectedSamples.value.map(s => s.id)
  try {
    const res = await sampleAPI.assign({ sample_ids: ids, inspector_id: selectedInspector.value })
    await loadSamples()
    selectedSamples.value = []
    selectedInspector.value = null
    alert(`分配成功：${res.data.success} 个，失败：${res.data.failed} 个`)
  } catch (err) {
    alert(err.response?.data?.error || '分配失败')
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
    stage: 'receiving'
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

const openReceiverNote = (row) => {
  currentIssueForNote.value = row
  receiverNoteForm.value = {
    transport_note: ''
  }
  showReceiverNote.value = true
}

const handleSubmitReceiverNote = async () => {
  if (!currentIssueForNote.value || !receiverNoteForm.value.transport_note) {
    alert('请填写运输说明')
    return
  }
  try {
    await coldChainAPI.submitReceiverNote(currentIssueForNote.value.id, {
      transport_note: receiverNoteForm.value.transport_note
    })
    showReceiverNote.value = false
    alert('运输说明已提交，等待检测员评估')
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
    ws.send(JSON.stringify({ type: 'subscribe', role: 'sample_receiver' }))
  }
  ws.onmessage = () => {
    loadSamples()
    loadInspectors()
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
  loadInspectors()
  loadColdChainIssues()
  connectWebSocket()
})

onUnmounted(() => {
  if (ws) ws.close()
})
</script>

<style scoped>
.receiver-view {
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

.batch-action {
  margin-top: 16px;
  display: flex;
  align-items: center;
  padding: 12px;
  background: #fafafa;
  border-radius: 4px;
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