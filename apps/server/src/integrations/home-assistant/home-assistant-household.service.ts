import type { HouseholdAlert, RoomStatus, ShoppingItem, TodoItem } from '@family-display/contracts';
import type { HomeAssistantClient, HomeAssistantState, HomeAssistantTodoItem } from './home-assistant.client.js';
import { selectTodayTodos } from '../../modules/dashboard/today-todos.js';

type HouseholdSource = Pick<HomeAssistantClient, 'getStates' | 'getTodoItems'>;

const TODO_ENTITY = 'todo.dai_ban_shi_xiang';
const SHOPPING_ENTITY = 'todo.shopping_list';
const DOOR_ENTITY = 'sensor.xiaomi_cn_1193916199_s1_door_state_p_3_1021';
const stateLabel = (state: string | undefined) => ({ on: '开启', off: '关闭', open: '打开', closed: '关闭', opening: '打开中', closing: '关闭中', unavailable: '离线' } as Record<string, string>)[state ?? ''] ?? state ?? '未知';
const livingLightEntities = [
  'switch.ke_ting_zhu_deng_kai_guan', 'switch.bei_jing_deng_dai_kai_guan',
  'switch.ke_ting_deng_dai_kai_guan', 'switch.guo_dao_tong_deng_kai_guan',
  'switch.gui_dao_deng_kai_guan', 'switch.xie_ju_deng_dai_kai_guan',
] as const;

const roomMappings = [
  {
    id: 'living', name: '客厅', climate: 'climate.ke_ting_kong_diao_kong_diao', floor: 'climate.ke_ting_di_nuan_di_nuan',
    temperature: 'sensor.xiaomi_cn_blt_3_1p22r1u6o4001_mini_temperature_p_2_1001',
    humidity: 'sensor.xiaomi_cn_blt_3_1p22r1u6o4001_mini_relative_humidity_p_2_1002',
  },
  {
    id: 'master', name: '主卧', climate: 'climate.zhu_wo_kong_diao_kong_diao', floor: 'climate.zhu_wo_di_nuan_di_nuan',
    temperature: 'sensor.miaomiaoc_cn_blt_3_1ddrtj6205k00_t2_temperature_p_2_1',
    humidity: 'sensor.miaomiaoc_cn_blt_3_1ddrtj6205k00_t2_relative_humidity_p_2_2',
  },
  { id: 'study', name: '书房', climate: 'climate.bei_ci_wo_kong_diao_kong_diao', floor: 'climate.bei_ci_wo_di_nuan_di_nuan', extra: 'light.shu_fang_deng', extraLabel: '灯光' },
  { id: 'guest', name: '次卧', climate: 'climate.nan_ci_wo_kong_diao_kong_diao', floor: 'climate.nan_ci_wo_di_nuan_di_nuan' },
] as const;

export interface HouseholdSnapshot {
  rooms: RoomStatus[];
  activeDeviceCount: number;
  doorStatus: string;
  todayTodos: TodoItem[];
  memos: TodoItem[];
  shopping: ShoppingItem[];
  alerts: HouseholdAlert[];
  updatedAt: string;
}

function numericState(state: HomeAssistantState | undefined) {
  if (!state || state.state === 'unknown' || state.state === 'unavailable') return null;
  const value = Number(state.state);
  return Number.isFinite(value) ? value : null;
}

function climateLabel(state: string | undefined) {
  return ({ off: '关闭', cool: '制冷', heat: '制热', dry: '除湿', fan_only: '送风', auto: '自动', unavailable: '不可用' } as Record<string, string>)[state ?? ''] ?? state ?? '未知';
}

function mapTodo(item: HomeAssistantTodoItem, index: number): TodoItem {
  const due = item.due
    ? /^\d{4}-\d{2}-\d{2}$/.test(item.due)
      ? { kind: 'date' as const, value: item.due }
      : { kind: 'datetime' as const, value: new Date(item.due).toISOString() }
    : null;
  return {
    id: item.uid ?? `ha-todo-${index}`,
    summary: item.summary?.trim() || '未命名事项',
    description: item.description?.replace(/\s+/g, ' ').trim() || null,
    due,
    completed: item.status === 'completed',
  };
}

export class HomeAssistantHouseholdService {
  private current: HouseholdSnapshot | null = null;
  private timer: NodeJS.Timeout | null = null;
  private refreshing: Promise<void> | null = null;

  constructor(
    private readonly source: HouseholdSource,
    private readonly timezone: string,
    private readonly refreshIntervalMs: number,
    private readonly onError: (error: unknown) => void = () => undefined,
  ) {}

  async start() {
    await this.refresh();
    this.timer = setInterval(() => void this.refresh(), this.refreshIntervalMs);
    this.timer.unref();
  }

  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }
  getSnapshot() { return this.current ? structuredClone(this.current) : null; }

  refresh(): Promise<void> {
    if (this.refreshing) return this.refreshing;
    this.refreshing = this.update().finally(() => { this.refreshing = null; });
    return this.refreshing;
  }

  private async update() {
    try {
      const [states, lists] = await Promise.all([
        this.source.getStates(), this.source.getTodoItems([TODO_ENTITY, SHOPPING_ENTITY]),
      ]);
      const byId = new Map(states.map((state) => [state.entity_id, state]));
      const rooms = roomMappings.map((mapping): RoomStatus => {
        const climate = byId.get(mapping.climate);
        const temperature = 'temperature' in mapping ? numericState(byId.get(mapping.temperature)) : null;
        const humidity = 'humidity' in mapping ? numericState(byId.get(mapping.humidity)) : null;
        const comfortable = temperature !== null && humidity !== null && temperature >= 20 && temperature <= 29 && humidity >= 35 && humidity <= 80;
        const devices: NonNullable<RoomStatus['devices']> = [
          { label: '空调', state: climateLabel(climate?.state), tone: climate?.state && !['off', 'unknown', 'unavailable'].includes(climate.state) ? 'active' : climate?.state === 'unavailable' ? 'warning' : 'normal' },
          { label: '地暖', state: climateLabel(byId.get(mapping.floor)?.state), tone: byId.get(mapping.floor)?.state && !['off', 'unknown', 'unavailable'].includes(byId.get(mapping.floor)!.state) ? 'active' : byId.get(mapping.floor)?.state === 'unavailable' ? 'warning' : 'normal' },
        ];
        if (mapping.id === 'living') {
          const lightsOn = livingLightEntities.filter((entityId) => byId.get(entityId)?.state === 'on').length;
          devices.push({ label: '灯光', state: lightsOn ? `${lightsOn} 盏开启` : '全部关闭', tone: lightsOn ? 'active' : 'normal' });
        }
        if (mapping.id === 'master') {
          const curtain = stateLabel(byId.get('cover.zhu_wo_bu_lian_chuang_lian')?.state);
          const sheer = stateLabel(byId.get('cover.zhu_wo_sha_lian_chuang_lian')?.state);
          devices.push({ label: '布帘', state: curtain, tone: 'normal' });
          devices.push({ label: '纱帘', state: sheer, tone: 'normal' });
          const bedside = byId.get('light.yeelink_cn_534355950_bslamp2_s_2_light')?.state;
          devices.push({ label: '床头灯', state: stateLabel(bedside), tone: bedside === 'on' ? 'active' : bedside === 'unavailable' ? 'warning' : 'normal' });
        }
        if ('extra' in mapping) {
          const extraState = byId.get(mapping.extra)?.state;
          devices.push({ label: mapping.extraLabel, state: stateLabel(extraState), tone: extraState === 'unavailable' ? 'warning' : extraState === 'on' ? 'active' : 'normal' });
        }
        return {
          id: mapping.id, name: mapping.name, temperature, humidity,
          deviceName: '空调', deviceState: climateLabel(climate?.state),
          summary: temperature === null ? '暂无环境传感器' : comfortable ? '环境舒适' : '请留意环境',
          devices,
        };
      });
      rooms.push(
        {
          id: 'balcony', name: '阳台', temperature: null, humidity: null, deviceName: null, deviceState: null,
          summary: '设备状态',
          devices: [
            { label: '晾衣架', state: stateLabel(byId.get('cover.xiaomi_cn_2175535786_0003_s_2_airer')?.state), tone: byId.get('cover.xiaomi_cn_2175535786_0003_s_2_airer')?.state === 'unavailable' ? 'warning' : 'normal' },
            { label: '阳台灯', state: stateLabel(byId.get('light.xiaomi_cn_2175535786_0003_s_3_light')?.state), tone: byId.get('light.xiaomi_cn_2175535786_0003_s_3_light')?.state === 'unavailable' ? 'warning' : byId.get('light.xiaomi_cn_2175535786_0003_s_3_light')?.state === 'on' ? 'active' : 'normal' },
            { label: '夜灯', state: stateLabel(byId.get('switch.xiaomi_cn_2175535786_0003_night_light_switch_p_3_5')?.state), tone: byId.get('switch.xiaomi_cn_2175535786_0003_night_light_switch_p_3_5')?.state === 'unavailable' ? 'warning' : byId.get('switch.xiaomi_cn_2175535786_0003_night_light_switch_p_3_5')?.state === 'on' ? 'active' : 'normal' },
          ],
        },
      );
      const allTodos = (lists[TODO_ENTITY] ?? []).map(mapTodo);
      const shopping = (lists[SHOPPING_ENTITY] ?? []).map((item, index): ShoppingItem => ({
        id: item.uid ?? `ha-shopping-${index}`,
        summary: item.summary?.trim() || '未命名物品',
        completed: item.status === 'completed',
      }));
      const alerts: HouseholdAlert[] = [];
      rooms.filter((room) => room.humidity !== null && room.humidity > 80).forEach((room) => alerts.push({ id: `humidity-${room.id}`, title: `${room.name}湿度偏高`, detail: `当前 ${room.humidity}% · 建议通风或除湿`, severity: 'warning' }));
      if (byId.get(DOOR_ENTITY)?.state === '已上锁') alerts.push({ id: 'door', title: '门锁已上锁', detail: '入户门状态正常', severity: 'info' });
      if (byId.get('light.shu_fang_deng')?.state === 'unavailable') alerts.push({ id: 'study-light', title: '书房灯离线', detail: 'Matter 灯具当前无法连接', severity: 'warning' });
      if (byId.get('cover.xiaomi_cn_2175535786_0003_s_2_airer')?.state === 'unavailable') alerts.push({ id: 'airer', title: '阳台晾衣机离线', detail: '暂时无法读取设备状态', severity: 'warning' });
      const massagerBattery = numericState(byId.get('sensor.soocare_cn_1096569369_m14_battery_level_p_3_1'));
      if (massagerBattery !== null && massagerBattery < 35) alerts.push({ id: 'battery-massager', title: '按摩仪电量较低', detail: `当前 ${massagerBattery}%`, severity: 'warning' });
      this.current = {
        rooms,
        activeDeviceCount: states.filter((state) =>
          (state.entity_id.startsWith('light.') && state.state === 'on') ||
          (state.entity_id.startsWith('climate.') && !['off', 'unavailable', 'unknown'].includes(state.state)) ||
          (state.entity_id.startsWith('fan.') && state.state === 'on'),
        ).length,
        doorStatus: byId.get(DOOR_ENTITY)?.state ?? '未知',
        todayTodos: selectTodayTodos(allTodos, this.timezone),
        memos: allTodos.filter((item) => !item.completed),
        shopping,
        alerts,
        updatedAt: new Date().toISOString(),
      };
    } catch (error) { this.onError(error); }
  }
}
