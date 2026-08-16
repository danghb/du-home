import type { HouseholdAlert, RoomStatus, ShoppingItem, TodoItem } from '@family-display/contracts';
import type { HomeAssistantClient, HomeAssistantState, HomeAssistantTodoItem } from './home-assistant.client.js';
import { selectTodayTodos } from '../../modules/dashboard/today-todos.js';

type HouseholdSource = Pick<HomeAssistantClient, 'getStates' | 'getTodoItems'>;

const TODO_ENTITY = 'todo.dai_ban_shi_xiang';
const SHOPPING_ENTITY = 'todo.shopping_list';
const DOOR_ENTITY = 'sensor.xiaomi_cn_1193916199_s1_door_state_p_3_1021';
const FRIDGE_DOOR_ENTITIES = [
  'binary_sensor.94224c1966fa_refrigeratordoorstatus',
  'binary_sensor.94224c1966fa_freezerdoorstatus',
  'binary_sensor.94224c1966fa_refrigerator2doorstatus',
  'binary_sensor.94224c1966fa_freezer2doorstatus',
] as const;
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

function environmentSummary(temperature: number | null, humidity: number | null) {
  if (temperature === null && humidity === null) return '暂无环境传感器';
  const comfortableTemperature = temperature === null || (temperature >= 20 && temperature <= 29);
  const comfortableHumidity = humidity === null || (humidity >= 35 && humidity <= 80);
  return comfortableTemperature && comfortableHumidity ? '环境舒适' : '请留意环境';
}

function includesAny(value: string | undefined, labels: string[]) {
  return labels.some((label) => value?.includes(label));
}

function formatDuration(minutes: number) {
  const rounded = Math.max(0, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  if (!hours) return `${remainder} 分钟`;
  if (!remainder) return `${hours} 小时`;
  return `${hours} 小时 ${remainder} 分钟`;
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
        const floor = byId.get(mapping.floor);
        const temperature = 'temperature' in mapping ? numericState(byId.get(mapping.temperature)) : null;
        const humidity = 'humidity' in mapping ? numericState(byId.get(mapping.humidity)) : null;
        const devices: NonNullable<RoomStatus['devices']> = [];
        if (climate) devices.push({ label: '空调', state: climateLabel(climate.state), tone: !['off', 'unknown', 'unavailable'].includes(climate.state) ? 'active' : climate.state === 'unavailable' ? 'warning' : 'normal' });
        if (floor) devices.push({ label: '地暖', state: climateLabel(floor.state), tone: !['off', 'unknown', 'unavailable'].includes(floor.state) ? 'active' : floor.state === 'unavailable' ? 'warning' : 'normal' });
        if (mapping.id === 'living') {
          const livingLights = livingLightEntities.map((entityId) => byId.get(entityId)).filter((state) => state !== undefined);
          if (livingLights.length) {
            const lightsOn = livingLights.filter((state) => state.state === 'on').length;
            const allUnavailable = livingLights.every((state) => state.state === 'unavailable');
            devices.push({ label: '灯光', state: allUnavailable ? '离线' : lightsOn ? `${lightsOn} 盏开启` : '全部关闭', tone: allUnavailable ? 'warning' : lightsOn ? 'active' : 'normal' });
          }
        }
        if (mapping.id === 'master') {
          const curtain = byId.get('cover.zhu_wo_bu_lian_chuang_lian');
          const sheer = byId.get('cover.zhu_wo_sha_lian_chuang_lian');
          if (curtain) devices.push({ label: '布帘', state: stateLabel(curtain.state), tone: curtain.state === 'unavailable' ? 'warning' : 'normal' });
          if (sheer) devices.push({ label: '纱帘', state: stateLabel(sheer.state), tone: sheer.state === 'unavailable' ? 'warning' : 'normal' });
          const bedside = byId.get('light.yeelink_cn_534355950_bslamp2_s_2_light');
          if (bedside) devices.push({ label: '床头灯', state: stateLabel(bedside.state), tone: bedside.state === 'on' ? 'active' : bedside.state === 'unavailable' ? 'warning' : 'normal' });
        }
        if ('extra' in mapping) {
          const extraState = byId.get(mapping.extra);
          if (extraState) devices.push({ label: mapping.extraLabel, state: stateLabel(extraState.state), tone: extraState.state === 'unavailable' ? 'warning' : extraState.state === 'on' ? 'active' : 'normal' });
        }
        return {
          id: mapping.id, name: mapping.name, temperature, humidity,
          summary: environmentSummary(temperature, humidity),
          devices,
        };
      });
      const fridgeTemperature = numericState(byId.get('sensor.94224c1966fa_envtemperature'));
      const fridgeHumidity = numericState(byId.get('sensor.94224c1966fa_envhumidity'));
      const fridgeDoorStates = FRIDGE_DOOR_ENTITIES.map((entityId) => byId.get(entityId)?.state);
      const fridgeDoorOpen = fridgeDoorStates.some((value) => value === 'on');
      const fridgeDoorKnown = fridgeDoorStates.every((value) => value === 'on' || value === 'off');
      const riceCookerState = byId.get('sensor.chunmi_cn_476864993_eh1_status_p_2_1')?.state;
      const riceCookerActive = riceCookerState !== undefined && !includesAny(riceCookerState, ['待机', '关闭', 'unknown', 'unavailable']);
      const kitchenDevices: NonNullable<RoomStatus['devices']> = [];
      if (fridgeDoorStates.some((value) => value !== undefined)) kitchenDevices.push({
        label: '冰箱',
        state: fridgeDoorOpen ? '有门未关' : fridgeDoorKnown ? '正常' : '状态未知',
        tone: fridgeDoorOpen ? 'warning' : fridgeDoorKnown ? 'success' : 'normal',
      });
      if (riceCookerState !== undefined) kitchenDevices.push({
        label: '电饭煲', state: riceCookerState,
        tone: riceCookerState === 'unavailable' ? 'warning' : riceCookerActive ? 'active' : 'normal',
      });
      rooms.push({
        id: 'kitchen', name: '厨房', temperature: fridgeTemperature, humidity: fridgeHumidity,
        summary: environmentSummary(fridgeTemperature, fridgeHumidity),
        devices: kitchenDevices,
      });

      const washerPower = byId.get('switch.3c16404de016_onoffstatus')?.state;
      const washerMode = byId.get('select.3c16404de016_runningmode')?.state;
      const washerPhase = byId.get('sensor.3c16404de016_cyclephase')?.state;
      const washerRunning = washerPower === 'on'
        && !includesAny(washerMode, ['暂停', '待机', '关闭'])
        && !includesAny(washerPhase, ['待机', '未启动', '结束', '完成']);
      const washerHours = numericState(byId.get('sensor.3c16404de016_remainingtimehh')) ?? 0;
      const washerMinutes = numericState(byId.get('sensor.3c16404de016_remainingtimemm')) ?? 0;
      const washerRemaining = washerHours * 60 + washerMinutes;

      const dryerPower = byId.get('switch.3c16408fb2cb_onoffstatus')?.state;
      const dryerMode = byId.get('sensor.3c16408fb2cb_runningmode')?.state;
      const dryerPhase = byId.get('sensor.3c16408fb2cb_cyclephase')?.state;
      const dryerRunning = dryerPower === 'on'
        && !includesAny(dryerMode, ['暂停', '待机', '关闭'])
        && !includesAny(dryerPhase, ['待机', '未启动', '结束', '完成']);
      const dryerRemaining = numericState(byId.get('sensor.3c16408fb2cb_remainingdrytime')) ?? 0;

      const airerState = byId.get('cover.xiaomi_cn_2175535786_0003_s_2_airer')?.state;
      const balconyLightState = byId.get('light.xiaomi_cn_2175535786_0003_s_3_light')?.state;
      const nightLightState = byId.get('switch.xiaomi_cn_2175535786_0003_night_light_switch_p_3_5')?.state;
      const balconyDevices: NonNullable<RoomStatus['devices']> = [];
      if (airerState !== undefined) balconyDevices.push({ label: '晾衣架', state: stateLabel(airerState), tone: airerState === 'unavailable' ? 'warning' : 'normal' });
      if (balconyLightState !== undefined) balconyDevices.push({ label: '阳台灯', state: stateLabel(balconyLightState), tone: balconyLightState === 'unavailable' ? 'warning' : balconyLightState === 'on' ? 'active' : 'normal' });
      if (nightLightState !== undefined) balconyDevices.push({ label: '夜灯', state: stateLabel(nightLightState), tone: nightLightState === 'unavailable' ? 'warning' : nightLightState === 'on' ? 'active' : 'normal' });
      if ([washerPower, washerMode, washerPhase].some((value) => value !== undefined)) balconyDevices.push({
        label: '洗衣机',
        state: washerPower === undefined ? '未知' : washerPower === 'unavailable' ? '离线' : washerRunning ? washerPhase ?? washerMode ?? '运行中' : washerPower === 'on' ? washerPhase ?? washerMode ?? '待机' : '关闭',
        detail: washerRunning && washerRemaining > 0 ? `剩余 ${formatDuration(washerRemaining)}` : undefined,
        tone: washerPower === 'unavailable' ? 'warning' : washerRunning ? 'active' : 'normal',
      });
      if ([dryerPower, dryerMode, dryerPhase].some((value) => value !== undefined)) balconyDevices.push({
        label: '干衣机',
        state: dryerPower === undefined ? '未知' : dryerPower === 'unavailable' ? '离线' : dryerRunning ? dryerPhase ?? dryerMode ?? '运行中' : dryerPower === 'on' ? dryerPhase ?? dryerMode ?? '待机' : '关闭',
        detail: dryerRunning && dryerRemaining > 0 ? `剩余 ${formatDuration(dryerRemaining)}` : undefined,
        tone: dryerPower === 'unavailable' ? 'warning' : dryerRunning ? 'active' : 'normal',
      });
      rooms.push({
        id: 'balcony', name: '阳台', temperature: null, humidity: null,
        summary: '设备状态',
        devices: balconyDevices,
      });
      const allTodos = (lists[TODO_ENTITY] ?? []).map(mapTodo);
      const shopping = (lists[SHOPPING_ENTITY] ?? []).map((item, index): ShoppingItem => ({
        id: item.uid ?? `ha-shopping-${index}`,
        summary: item.summary?.trim() || '未命名物品',
        completed: item.status === 'completed',
      }));
      const alerts: HouseholdAlert[] = [];
      rooms.filter((room) => room.humidity !== null && room.humidity > 80).forEach((room) => alerts.push({ id: `humidity-${room.id}`, title: `${room.name}湿度偏高`, detail: `当前 ${room.humidity}% · 建议通风或除湿`, severity: 'warning' }));
      if (byId.get(DOOR_ENTITY)?.state === '已上锁') alerts.push({ id: 'door', title: '门锁已上锁', detail: '入户门状态正常', severity: 'info' });
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
