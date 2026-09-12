<template>
  <BaseModal title="分组管理" @close="emit('close')">
    <div class="manager-body">
      <div class="create-row">
        <input v-model="newGroup" placeholder="输入新分组名称" aria-label="新分组名称" @keyup.enter="create" />
        <div class="create-action" role="button" tabindex="0" @click="create"><Plus :size="15" /> 新建</div>
      </div>

      <div v-for="group in groups" :key="group" :class="['group-block', { expanded: expanded.has(group) }]">
        <div class="group-item" role="button" tabindex="0" @click="toggle(group)">
          <ChevronDown :class="['group-chevron', { collapsed: !expanded.has(group) }]" :size="15" />
          <div v-if="renaming !== group" class="group-name"><strong>{{ group }}</strong><span>{{ counts[group] ?? 0 }} 项</span></div>
          <input v-else v-model="renameText" aria-label="新的分组名称" @click.stop @keyup.enter="saveRename(group)" />
          <div v-if="renaming === group" class="small-action primary" role="button" tabindex="0" @click.stop="saveRename(group)">保存</div>
          <div v-if="renaming === group" class="small-action" role="button" tabindex="0" @click.stop="cancelRename">取消</div>
          <div v-else class="icon-action" role="button" tabindex="0" aria-label="重命名" @click.stop="startRename(group)"><Pencil :size="15" /></div>
          <div v-if="group !== defaultGroup && groups.length > 1" class="icon-action danger" role="button" tabindex="0" aria-label="删除分组" @click.stop="deleteGroup(group)"><Trash2 :size="15" /></div>
        </div>
        <div v-if="expanded.has(group)" class="fund-group">
          <div v-for="fund in funds[group]" :key="fund.code" class="fund-item">
            <span>{{ fund.name }} <small>{{ fund.code }}</small></span>
            <div class="fund-actions">
              <div class="move-trigger" role="button" tabindex="0" aria-label="移动基金分组" @click="openMovePicker(fund.code, group)">{{ group }} <ChevronRight :size="14" /></div>
              <div class="icon-action danger" role="button" tabindex="0" aria-label="删除基金" @click="emit('remove', fund.code, group)"><Trash2 :size="14" /></div>
            </div>
          </div>
          <div v-if="!funds[group]?.length" class="fund-empty">暂无基金</div>
        </div>
      </div>
    </div>
    <div v-if="movePicker" class="move-mask" role="presentation" @click.self="movePicker = null">
      <div class="move-picker" role="dialog" aria-label="选择目标分组">
        <strong>移动到分组</strong>
        <div v-for="target in groups" :key="target" :class="['move-option', { selected: target === moveTarget }]" role="button" tabindex="0" @click="selectMoveTarget(target)">{{ target }}<Check v-if="target === moveTarget" :size="15" /></div>
        <div class="move-footer"><div class="move-cancel" role="button" tabindex="0" @click="movePicker = null">取消</div><div class="move-save" role="button" tabindex="0" @click="saveMove">保存</div></div>
      </div>
    </div>
  </BaseModal>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { Check, ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-vue-next'
import BaseModal from '@/components/BaseModal.vue'

defineProps<{
  groups: string[]
  counts: Record<string, number>
  defaultGroup: string
  funds: Record<string, Array<{ code: string, name: string }>>
}>()

const emit = defineEmits<{
  close: []
  create: [name: string]
  rename: [from: string, to: string]
  delete: [name: string]
  move: [code: string, from: string, to: string]
  remove: [code: string, group: string]
}>()

const newGroup = ref('')
const renaming = ref('')
const renameText = ref('')
const expanded = ref(new Set<string>())
const movePicker = ref<{ code: string, from: string } | null>(null)
const moveTarget = ref('')

function create () {
  cancelRename()
  const name = newGroup.value.trim()
  if (!name) return
  emit('create', name)
  newGroup.value = ''
}

function deleteGroup (group: string) {
  cancelRename()
  emit('delete', group)
}

function startRename (group: string) {
  cancelRename()
  renaming.value = group
  renameText.value = group
}

function cancelRename () {
  renaming.value = ''
  renameText.value = ''
}

function saveRename (group: string) {
  const name = renameText.value.trim()
  if (!name) return
  emit('rename', group, name)
  renaming.value = ''
}

function openMovePicker (code: string, from: string) {
  cancelRename()
  movePicker.value = { code, from }
  moveTarget.value = from
}

function selectMoveTarget (to: string) {
  moveTarget.value = to
}

function saveMove () {
  if (!movePicker.value || movePicker.value.from === moveTarget.value) {
    movePicker.value = null
    return
  }
  emit('move', movePicker.value.code, movePicker.value.from, moveTarget.value)
  movePicker.value = null
}

function toggle (group: string) {
  cancelRename()
  const next = new Set(expanded.value)
  if (next.has(group)) next.delete(group)
  else next.add(group)
  expanded.value = next
}
</script>

<style lang="less" scoped>
.manager-body {
  height: calc(80vh - 72px);
  overflow-y: auto;
  padding: 2px 16px 18px;
}

.group-item,
.create-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 0;
  border-top: 1px solid var(--color-border);
}

.group-name {
  min-width: 0;
  flex: 1;
}

.group-name strong,
.group-name span {
  display: block;
}

.group-name strong { color: #273346; font-size: 14px; font-weight: 500; }

.group-name span {
  margin-top: 3px;
  color: #9a9da3;
  font-size: 11px;
}

.group-item input,
.create-row input {
  min-width: 0;
  height: 34px;
  flex: 1;
  padding: 0 12px;
  color: #273346;
  font-size: 13px;
  background: #eef2f7;
  border: 1px solid #dfe5ec;
  border-radius: 8px;
  outline: 0;
}

.group-item input:focus,
.create-row input:focus {
  border-color: #2767e8;
  background: #fff;
}

.default-tag,
.small-action,
.create-action {
  flex: none;
  font-size: 12px;
  border-radius: 3px;
}

.default-tag {
  padding: 5px 8px;
  color: #858990;
  background: #f0f1f3;
}

.small-action {
  min-width: 46px;
  padding: 7px 10px;
  text-align: center;
  color: #555960;
  background: #f0f1f3;
  border-radius: 10px;
  cursor: pointer;
}

.small-action.primary {
  color: #fff;
  background: #2767e8;
  border-radius: 8px;
}

.small-action.danger {
  color: #e14b52;
  background: #fff1f1;
}

.create-row {
  margin-top: 6px;
}

.create-action {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 13px;
  color: #fff;
  background: #2767e8;
  border-radius: 8px;
  cursor: pointer;
}

.manager-body p {
  margin: 2px 0 0;
  color: #9a9da3;
  font-size: 11px;
}

.fund-group { padding: 0; background: #f4f6f9; border-top: 1px solid #e7ebf0; }
.fund-group-title { margin-bottom: 7px; color: #626b78; font-size: 12px; }
.fund-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 48px; padding: 7px 10px; color: #273346; font-size: 13px; border-top: 1px solid #e1e6ec; }
.fund-item:first-child { border-top: 0; }
.fund-item span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fund-item small { color: #9aa5b4; }
.move-trigger { display: flex; align-items: center; gap: 3px; flex: none; min-height: 30px; padding: 0 8px; color: #526072; font-size: 12px; line-height: 1; background: #fff; border: 1px solid #dfe5ec; border-radius: 6px; cursor: pointer; }
.group-block { margin: 8px 0; overflow: hidden; background: #fff; border: 1px solid #e1e7ef; border-radius: 10px; }
.group-block.expanded { background: #fff; }
.group-block .group-item { padding: 9px 12px; border-top: 0; }
.group-chevron { flex: none; color: #9aa5b4; transition: transform 0.18s ease; }
.group-chevron.collapsed { transform: rotate(-90deg); }
.icon-action { display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; flex: none; color: #647286; background: #f1f4f8; border-radius: 6px; cursor: pointer; }
.icon-action.danger { color: #e0525b; background: #fff0f0; }
.fund-actions { display: flex; align-items: center; gap: 6px; }
.fund-empty { padding: 12px 10px 14px; color: #a0a8b5; font-size: 12px; }
.move-mask { position: fixed; top: 0; right: 0; bottom: 0; left: 0; z-index: 80; display: flex; align-items: flex-end; justify-content: center; background: rgba(20, 28, 40, 0.28); }
.move-picker { width: 100%; max-width: 520px; padding: 18px 16px calc(14px + env(safe-area-inset-bottom)); background: #fff; border-radius: 16px 16px 0 0; box-shadow: 0 -4px 18px rgba(24, 27, 32, 0.12); }
.move-picker strong { display: block; margin-bottom: 9px; color: #273346; font-size: 15px; }
.move-option { display: flex; align-items: center; justify-content: space-between; height: 42px; padding: 0 10px; color: #2767e8; font-size: 14px; border-top: 1px solid #edf0f4; cursor: pointer; }
.move-option.selected { background: #edf3ff; }
.move-cancel { height: 40px; margin-top: 7px; color: #6d7888; font-size: 13px; line-height: 40px; text-align: center; background: #f5f7fa; border-radius: 12px; cursor: pointer; }
.move-footer { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.move-footer .move-cancel { margin-top: 7px; }
.move-save { height: 40px; margin-top: 7px; color: #fff; font-size: 13px; line-height: 40px; text-align: center; background: #2767e8; border-radius: 12px; cursor: pointer; }
</style>
