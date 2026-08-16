import { describe, expect, it, vi } from 'vitest';
import { HomeAssistantHouseholdService } from './home-assistant-household.service.js';

function state(entity_id: string, value: string) {
  return { entity_id, state: value, attributes: {} };
}

describe('HomeAssistantHouseholdService', () => {
  it('maps room sensors, device states, door and todo lists', async () => {
    const source = {
      getStates: vi.fn().mockResolvedValue([
        state('sensor.xiaomi_cn_blt_3_1p22r1u6o4001_mini_temperature_p_2_1001', '28.9'),
        state('sensor.xiaomi_cn_blt_3_1p22r1u6o4001_mini_relative_humidity_p_2_1002', '75'),
        state('sensor.miaomiaoc_cn_blt_3_1ddrtj6205k00_t2_temperature_p_2_1', '27.8'),
        state('sensor.miaomiaoc_cn_blt_3_1ddrtj6205k00_t2_relative_humidity_p_2_2', '83.4'),
        state('climate.ke_ting_kong_diao_kong_diao', 'cool'),
        state('climate.zhu_wo_kong_diao_kong_diao', 'off'),
        state('climate.bei_ci_wo_kong_diao_kong_diao', 'off'),
        state('climate.nan_ci_wo_kong_diao_kong_diao', 'off'),
        state('sensor.xiaomi_cn_1193916199_s1_door_state_p_3_1021', '已上锁'),
        state('light.ke_ting_zhu_deng', 'on'),
        state('sensor.94224c1966fa_envtemperature', '30'),
        state('sensor.94224c1966fa_envhumidity', '70'),
        state('binary_sensor.94224c1966fa_refrigeratordoorstatus', 'off'),
        state('binary_sensor.94224c1966fa_freezerdoorstatus', 'off'),
        state('binary_sensor.94224c1966fa_refrigerator2doorstatus', 'off'),
        state('binary_sensor.94224c1966fa_freezer2doorstatus', 'off'),
        state('sensor.chunmi_cn_476864993_eh1_status_p_2_1', '待机中'),
        state('light.shu_fang_deng', 'unavailable'),
        state('cover.xiaomi_cn_2175535786_0003_s_2_airer', 'unavailable'),
      ]),
      getTodoItems: vi.fn().mockResolvedValue({
        'todo.dai_ban_shi_xiang': [{ uid: 'memo', summary: '家庭事项', description: ' 记得带钥匙\n和门卡 ', status: 'needs_action' }],
        'todo.shopping_list': [{ uid: 'milk', summary: '牛奶', status: 'needs_action' }],
      }),
    };
    const service = new HomeAssistantHouseholdService(source, 'Asia/Hong_Kong', 30_000);
    await service.start();
    const snapshot = service.getSnapshot();

    expect(snapshot?.rooms[0]).toMatchObject({ name: '客厅', temperature: 28.9, humidity: 75 });
    expect(snapshot?.rooms[0]?.devices?.[0]).toMatchObject({ label: '空调', state: '制冷', tone: 'active' });
    expect(snapshot?.rooms[2]).toMatchObject({ name: '书房', temperature: null, humidity: null });
    expect(snapshot?.rooms.find((room) => room.id === 'kitchen')).toMatchObject({
      temperature: 30,
      humidity: 70,
      summary: '请留意环境',
      devices: [{ label: '冰箱', state: '正常', tone: 'success' }, { label: '电饭煲', state: '待机中' }],
    });
    expect(snapshot?.alerts.map((alert) => alert.id)).not.toContain('study-light');
    expect(snapshot?.alerts.map((alert) => alert.id)).not.toContain('airer');
    expect(snapshot?.activeDeviceCount).toBe(2);
    expect(snapshot?.doorStatus).toBe('已上锁');
    expect(snapshot?.memos[0]).toMatchObject({ summary: '家庭事项', description: '记得带钥匙 和门卡' });
    expect(snapshot?.shopping[0]?.summary).toBe('牛奶');
    service.stop();
  });

  it('highlights an open fridge door and only exposes appliance remaining time while running', async () => {
    const source = {
      getStates: vi.fn().mockResolvedValue([
        state('binary_sensor.94224c1966fa_refrigeratordoorstatus', 'on'),
        state('binary_sensor.94224c1966fa_freezerdoorstatus', 'off'),
        state('binary_sensor.94224c1966fa_refrigerator2doorstatus', 'off'),
        state('binary_sensor.94224c1966fa_freezer2doorstatus', 'off'),
        state('switch.3c16404de016_onoffstatus', 'on'),
        state('select.3c16404de016_runningmode', '启动'),
        state('sensor.3c16404de016_cyclephase', '主洗'),
        state('sensor.3c16404de016_remainingtimehh', '1'),
        state('sensor.3c16404de016_remainingtimemm', '7'),
        state('switch.3c16408fb2cb_onoffstatus', 'on'),
        state('sensor.3c16408fb2cb_runningmode', '启动'),
        state('sensor.3c16408fb2cb_cyclephase', '烘干中'),
        state('sensor.3c16408fb2cb_remainingdrytime', '85'),
      ]),
      getTodoItems: vi.fn().mockResolvedValue({ 'todo.dai_ban_shi_xiang': [], 'todo.shopping_list': [] }),
    };
    const service = new HomeAssistantHouseholdService(source, 'Asia/Hong_Kong', 30_000);
    await service.start();
    const snapshot = service.getSnapshot();
    const kitchen = snapshot?.rooms.find((room) => room.id === 'kitchen');
    const balcony = snapshot?.rooms.find((room) => room.id === 'balcony');

    expect(kitchen?.devices?.[0]).toMatchObject({ label: '冰箱', state: '有门未关', tone: 'warning' });
    expect(balcony?.devices?.find((device) => device.label === '洗衣机')).toMatchObject({ state: '主洗', detail: '剩余 1 小时 7 分钟', tone: 'active' });
    expect(balcony?.devices?.find((device) => device.label === '干衣机')).toMatchObject({ state: '烘干中', detail: '剩余 1 小时 25 分钟', tone: 'active' });
    service.stop();
  });

  it('ignores stale appliance remaining time while powered off and idle', async () => {
    const source = {
      getStates: vi.fn().mockResolvedValue([
        state('switch.3c16404de016_onoffstatus', 'off'),
        state('select.3c16404de016_runningmode', '暂停'),
        state('sensor.3c16404de016_cyclephase', '待机/未启动'),
        state('sensor.3c16404de016_remainingtimehh', '1'),
        state('sensor.3c16404de016_remainingtimemm', '7'),
        state('switch.3c16408fb2cb_onoffstatus', 'off'),
        state('sensor.3c16408fb2cb_runningmode', '暂停'),
        state('sensor.3c16408fb2cb_cyclephase', '待机状态'),
        state('sensor.3c16408fb2cb_remainingdrytime', '485'),
      ]),
      getTodoItems: vi.fn().mockResolvedValue({ 'todo.dai_ban_shi_xiang': [], 'todo.shopping_list': [] }),
    };
    const service = new HomeAssistantHouseholdService(source, 'Asia/Hong_Kong', 30_000);
    await service.start();
    const appliances = service.getSnapshot()?.rooms.find((room) => room.id === 'balcony')?.devices ?? [];

    expect(appliances.find((device) => device.label === '洗衣机')).toEqual({ label: '洗衣机', state: '关闭', detail: undefined, tone: 'normal' });
    expect(appliances.find((device) => device.label === '干衣机')).toEqual({ label: '干衣机', state: '关闭', detail: undefined, tone: 'normal' });
    service.stop();
  });

  it('keeps the last snapshot when refresh fails', async () => {
    const source = {
      getStates: vi.fn().mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('offline')),
      getTodoItems: vi.fn().mockResolvedValue({ 'todo.dai_ban_shi_xiang': [], 'todo.shopping_list': [] }),
    };
    const service = new HomeAssistantHouseholdService(source, 'Asia/Hong_Kong', 30_000);
    await service.start();
    await service.refresh();
    expect(service.getSnapshot()).not.toBeNull();
    service.stop();
  });
});
