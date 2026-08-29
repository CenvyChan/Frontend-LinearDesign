<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';

import { Download, FolderOpened } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';

import initialXml from '#/views/form-model/phase0/phase0-approval.bpmn20.xml?raw';
import { createBpmnModeler } from '#/views/form-model/phase0/bpmn-probe';

interface CanvasService {
  zoom(mode: 'fit-viewport'): void;
}

defineOptions({ name: 'Phase0BpmnModelerProbe' });

const canvasRef = ref<HTMLElement>();
const exportedXml = ref('');
const fileInputRef = ref<HTMLInputElement>();
let modeler: ReturnType<typeof createBpmnModeler> | undefined;

async function importXml(xml: string) {
  if (!modeler) {
    return;
  }
  await modeler.importXML(xml);
  modeler.get<CanvasService>('canvas').zoom('fit-viewport');
}

function chooseFile() {
  fileInputRef.value?.click();
}

async function openFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) {
    return;
  }

  try {
    await importXml(await file.text());
    ElMessage.success('BPMN 已打开');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'BPMN 打开失败');
  } finally {
    input.value = '';
  }
}

async function exportXml() {
  if (!modeler) {
    return;
  }

  const result = await modeler.saveXML({ format: true });
  if (!result.xml) {
    ElMessage.error('BPMN 导出失败');
    return;
  }
  exportedXml.value = result.xml;

  const url = URL.createObjectURL(
    new Blob([result.xml], { type: 'application/xml;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = 'phase0-approval.bpmn20.xml';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

onMounted(async () => {
  if (!canvasRef.value) {
    return;
  }
  modeler = createBpmnModeler(canvasRef.value);
  await importXml(initialXml);
});

onBeforeUnmount(() => {
  modeler?.destroy();
  modeler = undefined;
});
</script>

<template>
  <main class="phase0-modeler">
    <header class="phase0-modeler__toolbar">
      <h1>流程设计器验证</h1>
      <div class="phase0-modeler__actions">
        <input
          ref="fileInputRef"
          accept=".bpmn,.xml"
          class="phase0-modeler__file"
          type="file"
          @change="openFile"
        />
        <el-button :icon="FolderOpened" @click="chooseFile">打开 BPMN</el-button>
        <el-button
          data-testid="export-bpmn"
          :icon="Download"
          type="primary"
          @click="exportXml"
        >
          导出 BPMN
        </el-button>
      </div>
    </header>
    <section
      ref="canvasRef"
      aria-label="BPMN 流程画布"
      class="phase0-modeler__canvas"
      data-testid="bpmn-canvas"
    ></section>
    <output data-testid="exported-bpmn" hidden>{{ exportedXml }}</output>
  </main>
</template>

<style scoped>
.phase0-modeler {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  height: 100%;
  min-height: 640px;
  background: #f4f6f8;
}

.phase0-modeler__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 64px;
  padding: 12px 20px;
  border-bottom: 1px solid #d8dee6;
  background: #ffffff;
}

.phase0-modeler__toolbar h1 {
  margin: 0;
  color: #1f2937;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0;
}

.phase0-modeler__actions {
  display: flex;
  gap: 8px;
}

.phase0-modeler__file {
  display: none;
}

.phase0-modeler__canvas {
  min-height: 0;
  background: #ffffff;
}

@media (max-width: 640px) {
  .phase0-modeler__toolbar {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }
}
</style>
