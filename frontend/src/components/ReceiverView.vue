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
            <el-table-column label="操作" width="150">
              <template #default="scope">
                <el-button size="small" @click="showAudit(scope.row)">查看记录</el-button>
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
            <el-table-column label="操作" width="150">
              <template #default="scope">
                <el-button size="small" @click="showAudit(scope.row)">查看记录</el-button>
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
import { sampleAPI, userAPI } from '../utils/api'

const activeTab = ref('pending_handover')
const samples = ref([])
const selectedSamples = ref([])
const selectedInspector = ref(null)
const inspectors = ref([])
const showAddForm = ref(false)
const showAuditDialog = ref(false)
const auditLogs = ref([])
const addFormRef = ref(null)

const addForm = ref({
  source_unit: '',
  sample_type: '',
  test_items: '',
  received_at: ''
})

const addRules = {
  source_unit: [{ required: true, message: '请输入来源单位', trigger: 'blur' }],
  sample_type: [{ required: true, message: '请选择样本类型', trigger: 'change' }],
  test_items: [{ required: true, message: '请输入送检项目', trigger: 'blur' }],
  received_at: [{ required: true, message: '请选择接收时间', trigger: 'change' }]
}

const pendingSamples = computed(() => samples.value.filter(s => s.status === 'pending_handover'))
const assignedSamples = computed(() => samples.value.filter(s => s.status === 'handover_assigned'))

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

let ws = null

const connectWebSocket = () => {
  ws = new WebSocket('ws://localhost:3000')
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'subscribe', role: 'sample_receiver' }))
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
  loadInspectors()
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
</style>
