<script lang="ts" setup>
import type { NotificationItem } from '@vben/layouts';

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { AuthenticationLoginExpiredModal } from '@vben/common-ui';
import { VBEN_DOC_URL, VBEN_GITHUB_URL } from '@vben/constants';
import { useWatermark } from '@vben/hooks';
import { BookOpenText, CircleHelp, SvgGithubIcon } from '@vben/icons';
import {
  BasicLayout,
  LockScreen,
  Notification,
  UserDropdown,
} from '@vben/layouts';
import { preferences, usePreferences } from '@vben/preferences';
import { useAccessStore, useUserStore } from '@vben/stores';
import { openWindow } from '@vben/utils';

import dayjs from 'dayjs';
import { ElNotification } from 'element-plus';

import {
  deleteMyNotification,
  getMyInbox,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationInboxItem,
} from '#/api/notification';
import { $t } from '#/locales';
import { useAuthStore } from '#/store';
import ErpAcctSwitcher from '#/components/ErpAcctSwitcher.vue';
import LoginForm from '#/views/_core/authentication/login.vue';

/** 站内信轮询间隔：30 秒。项目未接入 WebSocket/SSE，采用轮询实现近实时预览。 */
const NOTIFICATION_POLL_INTERVAL = 30 * 1000;
/** 铃铛下拉面板展示条数，避免收件箱过长时一次性拉取过多数据 */
const NOTIFICATION_PANEL_SIZE = 20;

const notifications = ref<NotificationItem[]>([]);
/** 记录已知的未读条目 id，用于轮询后 diff 出"新到达"的通知触发右下角预览 */
const knownUnreadIds = ref<Set<number>>(new Set());
let notificationPollTimer: ReturnType<typeof setInterval> | null = null;

function toNotificationItem(item: NotificationInboxItem): NotificationItem {
  return {
    id: item.id,
    avatar: preferences.app.defaultAvatar,
    date: item.createTime
      ? dayjs(item.createTime).format('YYYY-MM-DD HH:mm')
      : '',
    isRead: item.isRead,
    message: item.content ?? '',
    title: item.title ?? '通知',
  };
}

async function refreshNotifications({ notifyNew = false } = {}) {
  try {
    const res: any = await getMyInbox({
      page: 0,
      size: NOTIFICATION_PANEL_SIZE,
    });
    const rows: NotificationInboxItem[] = Array.isArray(res)
      ? res
      : (res?.data ?? []);
    const previousKnownIds = knownUnreadIds.value;
    const currentUnreadIds = new Set(
      rows.filter((row) => !row.isRead).map((row) => row.id),
    );
    if (notifyNew && previousKnownIds.size > 0) {
      const newlyArrived = rows.filter(
        (row) => !row.isRead && !previousKnownIds.has(row.id),
      );
      for (const item of newlyArrived) {
        ElNotification({
          title: item.title ?? '新通知',
          message: item.content ?? '',
          position: 'bottom-right',
          type: 'info',
        });
      }
    }
    knownUnreadIds.value = currentUnreadIds;
    notifications.value = rows.map(toNotificationItem);
  } catch {
    // 轮询失败静默忽略，不打扰用户；下一轮轮询自动重试
  }
}

onMounted(() => {
  refreshNotifications();
  notificationPollTimer = setInterval(() => {
    refreshNotifications({ notifyNew: true });
  }, NOTIFICATION_POLL_INTERVAL);
});

onBeforeUnmount(() => {
  if (notificationPollTimer !== null) {
    clearInterval(notificationPollTimer);
    notificationPollTimer = null;
  }
});

const router = useRouter();
const userStore = useUserStore();
const authStore = useAuthStore();
const accessStore = useAccessStore();
const { destroyWatermark, updateWatermark } = useWatermark();
const { isDark } = usePreferences();
const showDot = computed(() =>
  notifications.value.some((item) => !item.isRead),
);

const menus = computed(() => [
  {
    handler: () => {
      router.push({ name: 'Profile' });
    },
    icon: 'lucide:user',
    text: $t('page.auth.profile'),
  },
  {
    handler: () => {
      openWindow(VBEN_DOC_URL, {
        target: '_blank',
      });
    },
    icon: BookOpenText,
    text: $t('ui.widgets.document'),
  },
  {
    handler: () => {
      openWindow(VBEN_GITHUB_URL, {
        target: '_blank',
      });
    },
    icon: SvgGithubIcon,
    text: 'GitHub',
  },
  {
    handler: () => {
      openWindow(`${VBEN_GITHUB_URL}/issues`, {
        target: '_blank',
      });
    },
    icon: CircleHelp,
    text: $t('ui.widgets.qa'),
  },
]);

const avatar = computed(() => {
  return userStore.userInfo?.avatar ?? preferences.app.defaultAvatar;
});

async function handleLogout() {
  await authStore.logout(false);
}

async function handleNoticeClear() {
  const ids = notifications.value.map((item) => item.id).filter((id): id is number => typeof id === 'number');
  notifications.value = [];
  await Promise.all(ids.map((id) => deleteMyNotification(id).catch(() => {})));
}

async function markRead(id: number | string) {
  const item = notifications.value.find((item) => item.id === id);
  if (item) {
    item.isRead = true;
  }
  if (typeof id === 'number') {
    try {
      await markNotificationRead(id);
    } catch {
      // 标记已读失败不影响交互，下次轮询会重新拉取真实状态
    }
  }
}

async function remove(id: number | string) {
  notifications.value = notifications.value.filter((item) => item.id !== id);
  if (typeof id === 'number') {
    try {
      await deleteMyNotification(id);
    } catch {
      // 删除失败不影响交互，下次轮询会重新拉取真实状态
    }
  }
}

async function handleMakeAll() {
  notifications.value.forEach((item) => (item.isRead = true));
  try {
    await markAllNotificationsRead();
  } catch {
    // 标记全部已读失败不影响交互，下次轮询会重新拉取真实状态
  }
}

const viewAll = () => {};

const handleClick = (item: NotificationItem) => {
  // 如果通知项有链接，点击时跳转
  if (item.link) {
    navigateTo(item.link, item.query, item.state);
  }
};

function navigateTo(
  link: string,
  query?: Record<string, any>,
  state?: Record<string, any>,
) {
  if (link.startsWith('http://') || link.startsWith('https://')) {
    // 外部链接，在新标签页打开
    window.open(link, '_blank');
  } else {
    // 内部路由链接，支持 query 参数和 state
    router.push({
      path: link,
      query: query || {},
      state,
    });
  }
}

watch(
  () => ({
    enable: preferences.app.watermark,
    content: preferences.app.watermarkContent,
    isDark: isDark.value,
  }),
  async ({ enable, content, isDark: isDarkValue }) => {
    if (enable) {
      const watermarkColor = isDarkValue
        ? 'rgba(255, 255, 255, 0.12)'
        : 'rgba(0, 0, 0, 0.12)';

      await updateWatermark({
        advancedStyle: {
          colorStops: [
            {
              color: watermarkColor,
              offset: 0,
            },
            {
              color: watermarkColor,
              offset: 1,
            },
          ],
          type: 'linear',
        },
        content:
          content ||
          `${userStore.userInfo?.username} - ${userStore.userInfo?.realName}`,
      });
    } else {
      destroyWatermark();
    }
  },
  {
    immediate: true,
  },
);
</script>

<template>
  <BasicLayout @clear-preferences-and-logout="handleLogout">
    <template #header-right-15>
      <ErpAcctSwitcher />
    </template>
    <template #user-dropdown>
      <UserDropdown
        :avatar
        :menus
        :text="userStore.userInfo?.realName"
        description="ann.vben@gmail.com"
        tag-text="Pro"
        @logout="handleLogout"
      />
    </template>
    <template #notification>
      <Notification
        :dot="showDot"
        :notifications="notifications"
        @clear="handleNoticeClear"
        @read="(item) => item.id && markRead(item.id)"
        @remove="(item) => item.id && remove(item.id)"
        @make-all="handleMakeAll"
        @on-click="handleClick"
        @view-all="viewAll"
      />
    </template>
    <template #extra>
      <AuthenticationLoginExpiredModal
        v-model:open="accessStore.loginExpired"
        :avatar
      >
        <LoginForm />
      </AuthenticationLoginExpiredModal>
    </template>
    <template #lock-screen>
      <LockScreen :avatar @to-login="handleLogout" />
    </template>
  </BasicLayout>
</template>
