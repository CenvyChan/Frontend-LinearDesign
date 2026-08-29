import type { App, Component } from 'vue';

import {
  ArrowLeft,
  Check,
  CircleCheck,
  CircleClose,
  CopyDocument,
  Delete,
  Document,
  Download,
  Edit,
  EditPen,
  Plus,
  Printer,
  Refresh,
  RefreshRight,
  Search,
  Sort,
  Upload,
  User,
  VideoPlay,
  View,
} from '@element-plus/icons-vue';

const buttonIcons: Record<string, Component> = {
  ArrowLeft,
  Check,
  CircleCheck,
  CircleClose,
  CopyDocument,
  Delete,
  Document,
  Download,
  Edit,
  EditPen,
  Plus,
  Printer,
  Refresh,
  RefreshRight,
  Search,
  Sort,
  Upload,
  User,
  VideoPlay,
  View,
};

function registerButtonIcons(app: App) {
  Object.entries(buttonIcons).forEach(([name, component]) => {
    app.component(name, component);
  });
}

export { registerButtonIcons };
